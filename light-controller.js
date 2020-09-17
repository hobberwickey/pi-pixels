const timer = new (require('nanotimer'))();
const ws281x = require('rpi-ws281x-native');

var NUM_LEDS = 10,
    pixelData = new Uint32Array(NUM_LEDS);

ws281x.init(NUM_LEDS);

class LightController {
  constructor() {
    this.pixels = [];

    timer.setInterval(() => {
      var i=NUM_LEDS;
      while(i--) {
          pixelData[i] = (this.pixels[i] << 16) + (this.pixels[i] << 8) + (this.pixels[i] << 0)
      }
      ws281x.render(pixelData);
    }, "", '41ms') 
  }

  set(pixels) {
  	this.pixels = pixels;
  }

  get() {
  	return pixels;
  }
}

module.exports = LightController;