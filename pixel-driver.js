const timer = new (require('nanotimer'))();
const { Worker } = require('worker_threads');

const usb = require('usb')    
const present = require('present');
const ws281x = require('rpi-ws281x-native');

class Strand {
  constructor(id, device, pin, count) {
    this.id = id;
    this.device = device;
    this.pin = pin;
    this.pixels = new Array(count).fill(0);
  }
}

class Group {
  constructor(id, strands, layout) {
    this.id = id;
    this.strands = strands;
    this.worker = null;
    this.layout = layout || [];

    var defaultCode = `
      var frame = [],
          rFrequency = 0.1;
          bFrequency = 0.11;
          gFrequency = 0.49;

      for (var i=0; i<pixelCount; i++) {
        var r = 0.5 * (1 + Math.sin(2 * Math.PI * rFrequency * ((frameIdx + i) * (1 / 24)))),
            g = 0.5 * (1 + Math.sin(2 * Math.PI * gFrequency * ((frameIdx + i) * (1 / 24)))),
            b = 0.5 * (1 + Math.sin(2 * Math.PI * bFrequency * (frameIdx + i) * (1 / 24)));
        
        frame[i] = [r * 255, g * 255, b * 255];
      }

      parentPort.postMessage({id: '${ id }', frameIdx: frameIdx, frame: frame});
    `

    this.createWorker(defaultCode)
  }

  createWorker(code) {
    var script = `
      const { parentPort } = require('worker_threads');

      parentPort.on("message", data => {
        switch (data.cmd) {
          case 'get_frame':
            ((frameRate, frameIdx, pixelCount) => {
              ${ code }
            })(data.frameRate, data.frameIdx, data.pixelCount)

            break;
          case 'stop':
            self.close();
            break;
          default: 
            break;
        }
      });
    `

    // var blob = new Blob([code], { type: "text/javascript" })

    if (this.worker !== null) {
      this.worker.postMessage({cmd: "stop"})
    }
    
    this.worker = new Worker(script, {eval: true});
    this.worker.on("message", (e) => {
      for (var i=0; i<this.layout.length; i++) {
        var strand = this.strands[this.layout[i].strand];
            strand.pixels[this.layout[i].idx] = [e.frame[i][0], e.frame[i][1], e.frame[i][2]];
      }

      /*
        Take the pixel array returned by the worker, then set run through the 
        layout and set the pixel data on the appropriate strand
      */
    })

    this.worker.postMessage("hello"); 
  }

  update(layout, code) {
    this.layout = layout;
    this.worker = this.createWorker(code);
  }
}

class PixelDriver {
  constructor() {
    this.devices = {};
    this.strands = {};
    this.groups = {};
    this.frameCounter = 0;
    this.lastTick = present();
    this.fps = 24;    

    this.active = false;
    this.sending = false;

    // ws281x.init(300);
    usb.getDeviceList().map((device) => {
      if (device.deviceDescriptor.idVendor === 0x16c0) {
        device.open();

        device.interfaces.map((face) => {
          var id = this.genUUID(),
              usbIn = null,
              usbOut = null;

          face.endpoints.map((endpoint) => {
            if (endpoint.direction === "in") {
              usbIn = endpoint;
            } else if (endpoint.direction === "out") {
              usbOut = endpoint;
            }
          })

          if (usbIn !== null && usbOut !== null) {
            if (face.isKernelDriverActive()) {
              face.detachKernelDriver()
            }

            usbIn.startPoll(1, 1024)
            usbIn.on('data', (data) => {
              // console.log("From Teensy: ", data.toString())
            })
            usbIn.on("error", (err) => {
              // console.log(err)
            })

            this.devices[id] = {
              id: id,
              productId: device.deviceDescriptor.idProduct,
              vendorId: device.deviceDescriptor.idVendor,
              productName: "Teensy 4.0",
              productVendor: "teensy",
              api: device,
              interface: face,
              in: usbIn,
              out: usbOut,
              pins: [2, 3, 4, 7, 8, 9, 10, 11, 12, 15],
              frame: null
            }
          }
        })
      }
    })

    process.on('SIGINT', function () {
      console.log("closing")
      // ws281x.reset();
      process.nextTick(function () { process.exit(0); });
    });
  }

  start() {
    this.active = true;

    var deviceId = Object.keys(this.devices)[0] || "test";

    this.addStrand({device: deviceId, pin: 2, count: 300})
    this.addStrand({device: deviceId, pin: 3, count: 300})
    this.addStrand({device: deviceId, pin: 4, count: 300})
    this.addStrand({device: deviceId, pin: 7, count: 300})
    this.addStrand({device: deviceId, pin: 8, count: 300})
    this.addStrand({device: deviceId, pin: 15, count: 300})

    
    timer.setInterval(() => {
      var frame = this.buildFrame();
                  this.sendFrame(frame);

      var now = present(),
          elapsed = now - this.lastTick,
          frames = elapsed / (1000 / this.fps);
      
      for (var x in this.groups) {
        this.groups[x].worker.postMessage({
          cmd: "get_frame",
          frameRate: this.fps,
          frameIdx: this.frameCounter,
          pixelCount: this.groups[x].layout.length
        })
      }

      this.lastTick = now;
      this.frameCounter++;       
    }, "", "0.041s") 
  }

  genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  buildFrame() {
    for (var x in this.devices) {
      this.devices[x].frame = new Uint8ClampedArray(this.devices[x].pins.length * (300 * 5));
    }

    for (var x in this.strands) {
      var strand = this.strands[x],
          device = this.devices[strand.device];

      if (!device) {
        continue
      }

      var frame = device.frame,
          pinOffset = device.pins.indexOf(strand.pin) * 300,
          pixels = strand.pixels,
          lenPixels = pixels.length;
      
      var i = lenPixels
      while(i--) {
        var pixel = pixels[i] || [0, 0, 0],
            idx = pinOffset + i,
            offset = idx * 5;

        frame[offset + 0] = (idx & 0xff00) >> 8;
        frame[offset + 1] = (idx & 0x00ff);
        frame[offset + 2] = pixel[1];
        frame[offset + 3] = pixel[0];
        frame[offset + 4] = pixel[2]; 
      }
    }
  }

  sendFrame() {
    var devices = this.devices;

    for (var x in devices) {
      if (devices[x].frame !== null && this.sending !== true) {
        try {
          this.sending = true;
          devices[x].interface.claim();
          devices[x].out.transfer(devices[x].frame, () => {
            devices[x].interface.release(() => {});
            this.sending = false;
          })

          // var pixelCount = (devices[x].frame.length / 5) | 0;
          // this.sendPixel(devices[x], pixelCount, 0)
        } catch(e) {
          console.log(e)
        }
      }
    }

    // while(i--) {
    //     var pixel = pixels[i] || [0, 0, 0];
    //     pixelData[i] = (pixel[1] << 16) + (pixel[0] << 8) + (pixel[2] << 0)
    // }

    // console.log(frame[0]);
    // ws281x.render(frame[0]);
  }

  sendPixels(device, pixelCount, idx) {
    var pixel = new Uint8ClampedArray(1000),
        pixelIdx = idx * 5;

    for (var i=0; i<200; i++) {
      var pos = i*5;

      pixel[pos + 0] = device.frame[pixelIdx + 0];
      pixel[pos + 1] = device.frame[pixelIdx + 1];
      pixel[pos + 2] = device.frame[pixelIdx + 2];
      pixel[pos + 3] = device.frame[pixelIdx + 3];
      pixel[pos + 4] = device.frame[pixelIdx + 4];

      pixelIdx++;
    }

    // console.log(pixelCount, idx, pixel);

    device.out.transfer(pixel, () => {
      if (idx + 200 >= pixelCount) {
        device.interface.release(() => {});
      } else {
        this.sendPixel(device, pixelCount, idx + 200)
      }
    })
  }

  sendPixel(device, pixelCount, idx) {
    var pixel = new Uint8ClampedArray(5),
        pixelIdx = idx * 5;

    pixel[0] = device.frame[pixelIdx + 0];
    pixel[1] = device.frame[pixelIdx + 1];
    pixel[2] = device.frame[pixelIdx + 2];
    pixel[3] = device.frame[pixelIdx + 3];
    pixel[4] = device.frame[pixelIdx + 4];

    // console.log(pixelCount, idx, pixel);

    device.out.transfer(pixel, () => {
      if (idx + 1 >= pixelCount) {
        device.interface.release(() => {});
      } else {
        this.sendPixel(device, pixelCount, idx + 1)
      }
    })
  }

  getDevices() {
    return this.devices()
  }
 
  addStrand(data) {
    var strand = new Strand(this.genUUID(), data.device, data.pin || -1, data.count || 300),
        layout = strand.pixels.map((p, i) => { return {strand: strand.id, idx: i} }),
        group = new Group(this.genUUID(), this.strands, layout);

    this.strands[strand.id] = strand;
    this.groups[group.id] = group;
  }

  removeStrand(data) {

  }

  updateStrand(data) {

  }

  addGroup(data) {

  }

  removeGroup(data) {

  }

  updateGroup(data) {

  }
}

module.exports = PixelDriver;