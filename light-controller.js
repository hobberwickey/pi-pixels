var timer = new (require('nanotimer'))();

class LightController {
  constructor() {
    this.pixels = [];

    // timer.setInterval(() => {
    //   console.log(this.pixels)
    // }, "", '41ms') 
  }

  set(pixels) {
  	this.pixels = pixels;
  }

  get() {
  	return pixels;
  }
}

module.exports = LightController;