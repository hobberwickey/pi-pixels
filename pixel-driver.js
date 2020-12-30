const timer = new (require('nanotimer'))();
const { Worker } = require('worker_threads');

const HID = require('node-hid');
    
const present = require('present');
const ws281x = require('rpi-ws281x-native');

class Strand {
  constructor(id, pin, count) {
    this.id = id;
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
    this.strands = {};
    this.groups = {};
    this.frameCounter = 0;
    this.lastTick = present();
    this.fps = 24;    

    this.active = false;

    // ws281x.init(300);

    var devices = HID.devices();
    console.log("Devices", devices)

    process.on('SIGINT', function () {
      ws281x.reset();
      process.nextTick(function () { process.exit(0); });
    });
  }

  start() {
    this.active = true;
    this.addStrand({pin: -1, count: 300})

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
    var frames = [] 
    for (var x in this.strands) {
      var pixels = this.strands[x].pixels,
          i = pixels.length,
          frame = new Uint32Array(i);
          
      while(i--) {
          var pixel = pixels[i] || [0, 0, 0];
          frame[i] = (pixel[1] << 16) + (pixel[0] << 8) + (pixel[2] << 0)
      }

      frames.push(frame)
    }

    return frames
    // return JSON.stringify(frame);
  }

  sendFrame(frame) {

    // while(i--) {
    //     var pixel = pixels[i] || [0, 0, 0];
    //     pixelData[i] = (pixel[1] << 16) + (pixel[0] << 8) + (pixel[2] << 0)
    // }

    // console.log(frame[0]);
    // ws281x.render(frame[0]);
  }

  addStrand(data) {
    var strand = new Strand(this.genUUID(), data.pin || -1, data.count || 300),
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