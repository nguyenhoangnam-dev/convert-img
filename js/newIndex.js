let uploadBox = document.getElementById("upload-box");

let imagePattern = new RegExp("image/(png|jpeg|webp|bmp)");

let allBlob = [];
let imageId = 0;
// let loadingAnimation;

let ua = navigator.userAgent.toLowerCase();
let checkBrowser = function (r) {
  return r.test(ua);
};

let isOpera = checkBrowser(/opera/);
let isChrome = checkBrowser(/chrome/);
let isWebKit = checkBrowser(/webkit/);
let isSafari = !isChrome && checkBrowser(/safari/);

//toBlob polyfill
if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    value: function (callback, type, quality) {
      var dataURL = this.toDataURL(type, quality).split(",")[1];
      setTimeout(function () {
        var binStr = atob(dataURL),
          len = binStr.length,
          arr = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
          arr[i] = binStr.charCodeAt(i);
        }
        callback(new Blob([arr], { type: type || "image/png" }));
      });
    },
  });
}

// Safari and opera not support canvas filter.
if (isSafari || isOpera) {
  $("#blur").prop("disabled", true);
}

let MIME = {
  "image/jpeg": {
    ext: "jpg",
    pattern: [0xff, 0xd8, 0xff],
    mask: [0xff, 0xff, 0xff],
  },
  "image/png": {
    ext: "png",
    pattern: [0x89, 0x50, 0x4e, 0x47],
    mask: [0xff, 0xff, 0xff, 0xff],
  },
  "image/webp": {
    ext: "webp",
    pattern: [0x52, 0x49, 0x46, 0x46],
    mask: [0xff, 0xff, 0xff, 0xff],
  },
  "image/bmp": {
    ext: "bmp",
    pattern: [0x42, 0x4d],
    mask: [0xff, 0xff],
  },
};

function check(bytes, mime) {
  for (var i = 0, l = mime.mask.length; i < l; ++i) {
    if ((bytes[i] & mime.mask[i]) - mime.pattern[i] !== 0) {
      return false;
    }
  }
  return true;
}

function roundBytes(bytes) {
  if (bytes >= 1048576) return Math.round((bytes / 1048576) * 10) / 10 + "MB";
  else if (bytes >= 1024) return Math.round((bytes / 1024) * 10) / 10 + "KB";
  else return bytes + "B";
}

// function disableZoomIn() {
//   $(".viewer-box").remove();
//   $(".zoom-selector").remove();
// }

function initializeProgress() {
  $("#progress-bar").val(0);
}

function progressDone() {
  $("#progress-bar").val(100);
}

function renderImage(canvas, type, ratio, loading) {
  canvas.toBlob(
    function (blob) {
      let newImageBlob = URL.createObjectURL(blob);
      $(".output-image").attr("src", newImageBlob);

      clearInterval(loading);

      progressDone();
    },
    "image/" + "png",
    ratio
  );
}

function setFilter(ctx, type, value) {}

function checkMIME(image) {
  let inputSize = image.size;
  let inputType = image.type;
  let fileBlob = image.slice(0, 4);

  // $("#input-name").text(inputName);
  // $("#input-size").text(roundBytes(inputSize));

  // Check mime type
  if (!imagePattern.test(inputType)) {
    alert("Invalid image type.");
  } else {
    let reader = new FileReader();
    reader.readAsArrayBuffer(fileBlob);

    reader.onloadend = function (e) {
      if (!e.target.error) {
        let bytes = new Uint8Array(e.target.result);
        if (check(bytes, MIME[inputType])) {
          if (inputSize > 52428800) {
            alert("File should be <= 50MB.");
          } else {
            handleFiles(image);
          }
        } else {
          alert("Can not read file.");
        }
      }
    };
  }
}

function handleFiles(image) {
  $("#panel-upload").addClass("disable");
  let inputName = image.name;

  $("#navbar")
    .append(`<div class="image-tag image-selected flex f-spacebetween f-vcenter hp-100" data-image='${imageId}'>
            <div class="image-name">${inputName}</div>
            <button class="btn-exist">
              <img class="icon-s" src="./img/time.svg" alt="exist">
            </button>
          </div>`);
  imageId++;

  let imageBlob = URL.createObjectURL(image);
  $(".upload-image").attr("src", imageBlob);
  allBlob.push(imageBlob);

  // $(".beforeafterdefault").cndkbeforeafter({
  //   mode: "drag",
  //   beforeTextPosition: "top-left",
  //   afterTextPosition: "top-right",
  // });

  // Create temporary image to get width, height, load event
  let img = document.createElement("img");
  img.src = imageBlob;
  img.style.width = "auto";
  img.style.height = "auto";

  img.onerror = function () {
    URL.revokeObjectURL(this.src);
    alert("Can not load image.");
  };

  img.onload = function (event) {
    let imgWidth = event.target.width;
    let imgHeight = event.target.height;

    if (imgWidth >= imgHeight) {
      $(".upload-image").addClass("w-100");
    } else {
      $(".review-box").addClass("hp-100");
      $(".upload-image").addClass("hp-100");
    }

    $(".upload-image").removeClass("disable");

    let startType = MIME[image.type].ext;
    let startMime = image.type;

    let scale = imgWidth / imgHeight;

    // $("#width").val(imgWidth);
    // $("#height").val(imgHeight);

    let canvas = document.createElement("canvas");
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    let ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

    let ratio = 1;
    var timeOutID = undefined;

    $("#contrast").on("input", function () {
      let value = $(this).val();
      $("#contrast-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        ctx.filter = `contrast(${value}%)`;
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress();
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, ratio, loadingAnimation);
      }, 200);
    });

    $("#contrast-value").on("change", function () {
      let value = $(this).val();
      $("#contrast").val(value);

      ctx.filter = `contrast(${value}%)`;
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        initializeProgress();
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, ratio, loadingAnimation);
      }, 200);
    });

    $("#brightness").on("input", function () {
      let value = $(this).val();
      $("#brightness-value").val(value);

      ctx.filter = `brightness(${value}%)`;
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        initializeProgress();
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, ratio, loadingAnimation);
      }, 200);
    });

    $("#brightness-value").on("change", function () {
      let value = $(this).val();
      $("#brightness").val(value);

      ctx.filter = `brightness(${value}%)`;
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        initializeProgress();
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, ratio, loadingAnimation);
      }, 200);
    });
  };

  // img.onload = function (e) {
  //   let startType = MIME[image.type].ext;

  //   let imgWidth = e.target.width;
  //   let imgHeight = e.target.height;
  //   let scale = imgWidth / imgHeight;

  //   $("#width").val(imgWidth);
  //   $("#height").val(imgHeight);

  //   let canvas = document.createElement("canvas");
  //   canvas.width = imgWidth;
  //   canvas.height = imgHeight;
  //   let ctx = canvas.getContext("2d");
  //   ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

  //   $("#convert").addClass("btn-select");

  //   $("#width").on("input", function () {
  //     let newImgWidth = $(this).val();
  //     let newImgHeight = newImgWidth / scale;

  //     imgWidth = newImgWidth;
  //     imgHeight = newImgHeight;

  //     $("#height").val(newImgHeight);

  //     canvas.width = newImgWidth;
  //     canvas.height = newImgHeight;
  //     ctx.drawImage(img, 0, 0, newImgWidth, newImgHeight);
  //   });

  //   $("#height").on("input", function () {
  //     let newImgHeight = $(this).val();
  //     let newImgWidth = newImgHeight * scale;

  //     imgWidth = newImgWidth;
  //     imgHeight = newImgHeight;

  //     $("#width").val(newImgWidth);

  //     canvas.width = newImgWidth;
  //     canvas.height = newImgHeight;
  //     ctx.drawImage(img, 0, 0, newImgWidth, newImgHeight);
  //   });

  //   $("#blur").on("click", function () {
  //     ctx.filter = "blur(10px)";
  //     ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
  //   });

  //   $("#convert").on("click", function () {
  //     initializeProgress();

  //     $("#output-size").text("0B");
  //     let destType = type.value;
  //     let ratio = parseInt(quality.value) / 10;

  //     let newFileName = image.name.replace(startType, destType);

  //     if (destType == "jpg") destType = "jpeg";

  //     let value = 0;

  //     let loadingAnimation = setInterval(function () {
  //       value++;
  //       $("#progress-bar").val(value);

  //       if (value == 90) {
  //         clearInterval(loadingAnimation);
  //       }
  //     }, 40);

  //     canvas.toBlob(
  //       function (blob) {
  //         let outputSize = roundBytes(blob.size);
  //         // $("#output-name").text(newFileName);
  //         $("#output-size").text(outputSize);

  //         let newImageBlob = URL.createObjectURL(blob);
  //         $(".download-image").attr("src", newImageBlob);
  //         $(".btn-download").removeClass("disable");

  //         $("#download").attr("download", newFileName);
  //         $("#download").attr("href", newImageBlob);

  //         clearInterval(loadingAnimation);

  //         progressDone();
  //       },
  //       "image/" + destType,
  //       ratio
  //     );
  //   });
  // };
}

$(".image-tag").on("click", function () {
  if (!$(this).hasClass("image-selected")) {
    $(".image-selected").removeClass("image-selected");
    $(this).addClass("image-selected");
  }
});

$(".btn-exist").on("click", function (event) {
  event.stopPropagation();
  $(this).parent().remove();
});

// Click to upload file
uploadBox.addEventListener("click", function () {
  this.classList.add("m-upload-select");
  $("#upload").click();
});

$("#upload").on("click", function (event) {
  event.stopPropagation();
});

$("#upload").on("change", function (event) {
  $("#upload-box").removeClass("m-upload-select");
  const fileList = this.files;
  let image = fileList[0];

  if (allBlob.length > 0) {
    URL.revokeObjectURL(allBlob[0]);
  }

  checkMIME(image);
});

// Drag upload file
["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  uploadBox.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

uploadBox.addEventListener("dragenter", function () {
  this.classList.add("m-upload-select");
});

uploadBox.addEventListener("dragleave", function () {
  this.classList.remove("m-upload-select");
});

uploadBox.addEventListener("dragover", function () {
  this.classList.add("m-upload-select");
});

uploadBox.addEventListener("drop", function (event) {
  this.classList.remove("m-upload-select");

  let data = event.dataTransfer;
  let fileList = data.files;
  let image = fileList[0];

  if (allBlob.length > 0) {
    URL.revokeObjectURL(allBlob[0]);
  }

  checkMIME(image);
});

// Drag scrolling preview mode

let slider = document.getElementById("preview-mode");
let isDown = false;
let startY;
let scrollTop;

slider.addEventListener("mousedown", (e) => {
  isDown = true;
  slider.classList.add("drag-active");
  startY = e.pageY - slider.offsetTop;
  scrollTop = slider.scrollTop;
});
slider.addEventListener("mouseleave", () => {
  isDown = false;
  slider.classList.remove("drag-active");
});
slider.addEventListener("mouseup", () => {
  isDown = false;
  slider.classList.remove("drag-active");
});
slider.addEventListener("mousemove", (e) => {
  if (!isDown) return;
  e.preventDefault();
  const y = e.pageY - slider.offsetTop;
  const walk = y - startY;
  slider.scrollTop = scrollTop - walk;
});
