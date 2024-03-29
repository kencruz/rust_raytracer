const submitButton = document.querySelector("#submitButton");
const saveButton = document.querySelector("#downloadButton");
const result = document.querySelector("#result");
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imageSizes = {
  "1": [200, 100],
  "2": [400, 200],
  "3": [800, 400],
  "4": [1280, 720],
  "5": [1920, 1080]
};

saveButton.addEventListener('click', () => {
    let dataURL = canvas.toDataURL('image/png');
    let tmpLink = document.createElement('a');
    tmpLink.download = 'image.png'
    tmpLink.href = dataURL;
    document.body.appendChild(tmpLink);
    tmpLink.click();
    document.body.removeChild(tmpLink);
});


submitButton.addEventListener("click", async () => {
  const [WIDTH, HEIGHT] = imageSizes[document.getElementById('imageSize')
    .value];
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const IMG = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  let count = HEIGHT;
  let received = 0;
  let t0;

  submitButton.disabled = true;
  const workerCount = Number(document.getElementById('workerNum')
    .value);
  let workers = [];
  for (let i = 0; i < workerCount; i++) {
    workers[i] = new Worker("./worker.js");
  }

  await Promise.all(workers.map(x => loaded(x)));
  t0 = performance.now();

  for (let i = 0; i < workers.length; i++) {
    let worker = workers[i];

    worker.addEventListener("message", ev => {
      const message = ev.data;
      if (message.allGood === true) {
        ctx.putImageData(message.imgData, 0, 0);
        result.textContent = message.time;
      } else if (message.allGood === "ready") {
        console.log(`worker ${i} is ready`);
        count--;
        worker.postMessage({
          job: true,
          count: count
        });
      } else if (message.allGood === false) {
        result.textContent = "Something went wrong! " + message.error;
      } else {
        received++;
        count--;
        if (count >= 0) {
          worker.postMessage({
            job: true,
            count: count
          });
        }
        for (let i = 0; i < message.imgRow.length; i++) {
          IMG[((HEIGHT - message.row) * WIDTH * 4) + i] = message.imgRow[i];
        }
        if (received % 10 === 0) {
          let imageData = new ImageData(IMG, WIDTH, HEIGHT);
          ctx.putImageData(imageData, 0, 0);
        }
        result.textContent = `${Math.floor(received * 100 / HEIGHT)}% complete`
        if (received === HEIGHT) {
          let imageData = new ImageData(IMG, WIDTH, HEIGHT);
          ctx.putImageData(imageData, 0, 0);
          let t1 = performance.now();
          result.textContent = `done in ${t1 - t0} ms`;
            saveButton.style.display = "initial";
        }
      }
    });
  }


  import("../../pkg")
    .then(wasm => {
      const world = wasm.scene_gen_json();
      for (let i = 0; i < workers.length; i++) {
        workers[i].postMessage({
          init: true,
          width: WIDTH,
          height: HEIGHT,
          world: world
        });
      }
    });
});

// helper to ensure worker is loaded before taking any jobs
const loaded = w => new Promise(r => w.addEventListener("message", r, {
  once: true
}));
