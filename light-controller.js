const timer = new (require('nanotimer'))();
const ws281x = require('rpi-ws281x-native');

var NUM_LEDS = 10,
    pixelData = new Uint32Array(NUM_LEDS);

ws281x.init(NUM_LEDS);

class LightController {
  constructor() {
    this.pixels = [];

    process.on('SIGINT', function () {
      ws281x.reset();
      process.nextTick(function () { process.exit(0); });
    });

    timer.setInterval(() => {
      var i=NUM_LEDS;
      while(i--) {
          var pixel = this.pixels[i] || [0, 255, 0];
          pixelData[i] = (pixel[0] << 16) + (pixel[1] << 8) + (pixel[2] << 0)
      }

      ws281x.render(pixelData);
    }, "", '41ms') 
  }

  set(pixels) {
    console.log(pixels)

  	this.pixels = pixels;
  }

  get() {
  	return pixels;
  }
}

module.exports = LightController;