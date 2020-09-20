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
      console.log("closing")
      ws281x.reset();
      process.nextTick(function () { process.exit(0); });
    });

    timer.setInterval(() => {
      var i=this.numPixels,
          pixelData = this.pixelData,
          pixels = this.bufferReady ? this.buffers[this.bufferIdx][this.bufferFrame] : [];

      console.log(this.bufferReady, this.bufferFrame, Date.now())
      while(i--) {
          var pixel = pixels[i] || [0, 0, 0];
          pixelData[i] = (pixel[1] << 16) + (pixel[0] << 8) + (pixel[2] << 0)
      }

      ws281x.render(pixelData);
      
      if (this.bufferReady) {
        this.bufferFrame = this.bufferFrame +1;
        if (this.bufferFrame >= this.buffers[this.bufferIdx].length){
          this.bufferFrame = 0;
          this.bufferIdx = this.bufferIdx === 0 ? 1 : 0; 
        }
      }
       
    }, "", "0.041s") 
  }

  set(buffer) {
    console.log(buffer)

    if (this.buffers.length === 2) {
      this.buffers[this.bufferIdx === 0 ? 1 : 0] = buffer;
      this.bufferReady = true;
    } else {
      this.buffers[this.buffers.length] = buffer;
    }
  }

  get() {
  	return pixels;
  }
}

module.exports = LightController;