const timer = new (require('nanotimer'))();
const ws281x = require('rpi-ws281x-native');

class LightController {
  constructor(numPixels) {
    this.numPixels = numPixels || 10;
    this.pixelData = new Uint32Array(this.numPixels);
    this.pixels = [];
    this.buffers = [];
    this.bufferIdx = 1;
    this.bufferFrame = 0;
    this.bufferReady = false;

    ws281x.init(this.numPixels);

    process.on('SIGINT', function () {
      ws281x.reset();
      process.nextTick(function () { process.exit(0); });
    });

    timer.setInterval(() => {
      var i=this.numPixels,
          pixelData = this.pixelData,
          pixels = {
            true: this.buffers[this.bufferIdx][this.bufferFrame],
            false : []
          }[this.bufferReady];

      while(i--) {
          pixelData[i] = (pixels[i][1] << 16) + (pixels[i][0] << 8) + (pixels[i][2] << 0)
      }

      ws281x.render(pixelData);
      
      if (this.bufferReady) {
        this.bufferFrame++;
        if (this.bufferFrame >= this.buffers[this.bufferIdx].length){
          this.bufferFrame = 0;
          this.bufferIdx = this.bufferIdx === 0 ? 1 : 0; 
        }
      }
       
    }, "", (1000 / 24) + "ms") 
  }

  set(buffer) {
    this.buffers[this.bufferIdx === 0 ? 1 : 0] = buffer;

    if (this.buffers.length === 2) {
      this.bufferReady = 1;
    }
  }

  get() {
  	return pixels;
  }
}

module.exports = LightController;