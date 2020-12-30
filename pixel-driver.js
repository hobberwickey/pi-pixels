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
      frame = [];

      for (var i=0; i<pixelCount; i++) {
        frame[i] = [255, 255, 0]
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

    // ws281x.init(300);

    
    usb.getDeviceList().map((device) => {
      if (device.deviceDescriptor.idVendor === 0x16c0) {
        device.open();
        
        var id = this.genUUID();

        this.devices[id] = {
          id: id,
          productId: device.deviceDescriptor.idProduct,
          vendorId: device.deviceDescriptor.idVendor,
          productName: "Teensy 4.0",
          productVendor: "teensy",
          api: device ,
          in: device.interfaces[1].endpoints[1],
          out: device.interfaces[1].endpoints[0],
          pins: [3, 5, 7, 9, 11, 14, 16, 18, 20, 22],
          frame: null
        }  
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

    this.addStrand({device: deviceId, pin: 3, count: 300})

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
          pixelCount: this.groups[x].layout.length,
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
          device = this.devices[strand.device],
          frame = device.frame,
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
      if (devices[x].frame !== null) {
        // console.log(devices[x])

        devices[x].out.claim();
        devices[x].transfer(devices[x].frame, () => {
          devices[x].out.release();
        })
      }
    }

    // while(i--) {
    //     var pixel = pixels[i] || [0, 0, 0];
    //     pixelData[i] = (pixel[1] << 16) + (pixel[0] << 8) + (pixel[2] << 0)
    // }

    // console.log(frame[0]);
    // ws281x.render(frame[0]);
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