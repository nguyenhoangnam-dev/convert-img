let uploadBox = document.getElementById("upload-box");

let imagePattern = new RegExp("image/(png|jpeg|webp|bmp|svg\\+xml)");
let htmlCommentRegex = /<!--([\s\S]*?)-->/g;
let svgPattern = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!doctype svg[^>]*\s*(?:\[?(?:\s*<![^>]*>\s*)*\]?)*[^>]*>\s*)?(?:<svg[^>]*>[^]*<\/svg>|<svg[^/>]*\/\s*>)\s*$/i;

let allBlob = [];
let imageId = 0;
let preFilter =
  "contrast(100%) brightness(100%) blur(0px) opacity(100%) saturate(100%) grayscale(0%) invert(0%) sepia(0%)";
let outputWidth;
let outputHeight;

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
  "image/svg+xml": {
    ext: "svg",
  },
};

function cleanEntities(svg) {
  const entityRegex = /\s*<!Entity\s+\S*\s*(?:"|')[^"]+(?:"|')\s*>/gim;
  // Remove entities
  return svg.replace(entityRegex, "");
}

function checkSVG(svg) {
  return (
    Boolean(svg) &&
    svgPattern.test(cleanEntities(svg.toString()).replace(htmlCommentRegex, ""))
  );
}

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

function initializeProgress(progress) {
  progress.val(0);
}

function progressDone(progress) {
  progress.val(100);
}

function renderImage(canvas, type, ratio, loading) {
  canvas.toBlob(function (blob) {
    let outputSize = roundBytes(blob.size);
    $("#file-size").text(outputSize);
    $("#output-size").text(outputSize);

    let newImageBlob = URL.createObjectURL(blob);
    $(".output-image").attr("src", newImageBlob);

    clearInterval(loading);

    progressDone($("#progress-bar"));
  }, type);
}

function setFilter(ctx, type, value) {
  let filter = ctx.filter;
  if (filter == "none") {
    filter =
      "contrast(100%) brightness(100%) blur(0px) opacity(100%) saturate(100%) grayscale(0%) invert(0%) sepia(0%)";
  }

  if (type == "blur") {
    value += "px";
  } else {
    value += "%";
  }

  let pattern = new RegExp(`${type}\\(\\d+(%|px)\\)`);
  preFilter = filter.replace(pattern, `${type}(${value})`);

  ctx.filter = preFilter;
}

function setOutputName(outputName) {
  let outputNameSplit = outputName.split(".");
  let type = outputNameSplit.pop();

  // jpg, jpeg, jpe have the same MIME
  if (type == "jpeg" || type == "jpe") type = "jpg";
  if (type == "svg") type = "png";
  let name = outputNameSplit.join(".");

  $("#output-name").val(name);
  $("#hide").text(name);
  $("#output-name").width($("#hide").width());
  $("#name-type").text(type);

  return name;
}

function getOutputName(inputName, inputType, destType) {
  let pattern = new RegExp(inputType + "$");
  return inputName.replace(pattern, destType);
}

function checkMIME(image) {
  let inputSize = image.size;
  let inputType = image.type;

  // Check mime type
  if (!imagePattern.test(inputType)) {
    alert("Invalid image type.");
  } else {
    if (inputType == "image/svg+xml") {
      let reader = new FileReader();

      reader.onload = function (event) {
        let svgContent = event.target.result;
        if (checkSVG(svgContent)) {
          if (inputSize > 52428800) {
            alert("File should be <= 50MB.");
          } else {
            handleFiles(image);
          }
        } else {
          alert("Can not read file.");
        }
      };

      reader.readAsText(image);
    } else {
      let fileBlob = image.slice(0, 4);
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
}

function handleFiles(image) {
  $("#panel-upload").addClass("disable");
  let inputName = image.name;
  let inputSize = roundBytes(image.size);
  let startMime = image.type;
  let startType = MIME[startMime].ext;

  $("#navbar")
    .append(`<div class="image-tag image-selected flex f-spacebetween f-vcenter hp-100">
            <div class="image-name">${inputName}</div>
            <div class="pop-up pop-up-bottom">
              <p>${inputName}</p>
            </div>
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
      $("#preview-image").addClass("w-100");
      $("#output-image").addClass("mw-export");
    } else {
      $("#output-image").addClass("mh-export");
      $(".review-box").addClass("hp-100");
      $("#preview-image").addClass("hp-100");
    }

    $(".upload-image").removeClass("disable");
    $("#file-size").text(inputSize);
    $("#file-type").text(startType);
    $("#file-dimension").text(`${imgWidth} x ${imgHeight}`);

    let canvas = document.createElement("canvas");
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    let ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

    $("#output-size").text(inputSize);

    $("#download").attr("download", inputName);
    $("#download").attr("href", imageBlob);

    var timeOutID = undefined;

    // Contrast
    $("#contrast").on("input", function () {
      let value = $(this).val();
      $("#contrast-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "contrast", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#contrast-value").on("change", function () {
      let value = $(this).val();
      $("#contrast").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "contrast", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    // Brightness
    $("#brightness").on("input", function () {
      let value = $(this).val();
      $("#brightness-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "brightness", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#brightness-value").on("change", function () {
      let value = $(this).val();
      $("#brightness").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "brightness", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    // Blur
    $("#blur-value").on("change", function () {
      let value = $(this).val();

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "blur", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    // Opacity
    $("#opacity").on("input", function () {
      let value = $(this).val();
      $("#opacity-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "opacity", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#opacity-value").on("change", function () {
      let value = $(this).val();
      $("#opacity").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "opacity", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    // Saturate
    $("#saturate").on("input", function () {
      let value = $(this).val();
      $("#saturate-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "saturate", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#saturate-value").on("change", function () {
      let value = $(this).val();
      $("#saturate").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "saturate", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#grayscale").on("input", function () {
      let value = $(this).val();
      $("#grayscale-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "grayscale", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#grayscale-value").on("change", function () {
      console.log("change");
      let value = $(this).val();
      $("#grayscale").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "grayscale", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#invert").on("input", function () {
      let value = $(this).val();
      $("#invert-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "invert", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#invert-value").on("change", function () {
      let value = $(this).val();
      $("#invert").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "invert", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#sepia").on("input", function () {
      let value = $(this).val();
      $("#sepia-value").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "sepia", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#sepia-value").on("change", function () {
      let value = $(this).val();
      $("#sepia").val(value);

      if (typeof timeOutID === "number") {
        window.clearTimeout(timeOutID);
      }

      timeOutID = window.setTimeout(function () {
        setFilter(ctx, "sepia", value);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        initializeProgress($("#progress-bar"));
        let progressValue = 0;

        let loadingAnimation = setInterval(function () {
          progressValue++;
          $("#progress-bar").val(progressValue);

          if (progressValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        renderImage(canvas, startMime, 1, loadingAnimation);
      }, 200);
    });

    $("#reset").on("click", function () {
      $("#contrast").val(100);
      $("#contrast-value").val(100);
      $("#brightness").val(100);
      $("#brightness-value").val(100);
      $("#opacity").val(100);
      $("#opacity-value").val(100);
      $("#saturate").val(100);
      $("#saturate-value").val(100);
      $("#invert").val(0);
      $("#invert-value").val(0);
      $("#sepia").val(0);
      $("#sepia-value").val(0);
      $("#grayscale").val(0);
      $("#grayscale-value").val(0);
      $("#blur-value").val(0);

      ctx.filter = "none";
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      initializeProgress($("#progress-bar"));
      let progressValue = 0;

      let loadingAnimation = setInterval(function () {
        progressValue++;
        $("#progress-bar").val(progressValue);

        if (progressValue == 90) {
          clearInterval(loadingAnimation);
        }
      }, 40);

      renderImage(canvas, startMime, 1, loadingAnimation);
    });

    $("#quality").on("input", function () {
      let qualityValue = $(this).val();
      $("#quality-value").val(qualityValue);
    });

    $("#quality-value").on("change", function () {
      let qualityValue = $(this).val();
      $("#quality").val(qualityValue);
    });

    $("#export").on("click", function () {
      let outputName = inputName;
      let destType = startType;
      if (startType == "svg") {
        destType = "png";
      }

      outputWidth = imgWidth;
      outputHeight = imgHeight;

      $(function () {
        $("#hide").text($("#output-name").val());
        outputName = $("#output-name").val() + "." + destType;
        $("#output-name").width($("#hide").width());
      }).on("input", function () {
        $("#hide").text($("#output-name").val());
        outputName = $("#output-name").val() + "." + destType;
        $("#output-name").width($("#hide").width());
      });

      if (destType == "png" || destType == "bmp") {
        if (!$("#image-quality").prop("disabled")) {
          $("#quality").val(100);
          $("#quality").prop("disabled", true);
          $("#quality-value").val(100);
          $("#quality-value").prop("disabled", true);
          $("#quality-option").addClass("add-pop-up");
        }
      } else {
        if ($("#quality").prop("disabled")) {
          $("#quality").prop("disabled", false);
          $("#quality-value").prop("disabled", false);
        }

        if (destType == "jpg") {
          $("#quality").val(92);
          $("#quality-value").val(92);
        } else if (destType == "webp") {
          $("#quality").val(80);
          $("#quality-value").val(80);
        }
        $("#quality-option").removeClass("add-pop-up");
      }

      $("#width").val(imgWidth);
      $("#height").val(imgHeight);

      $("#image-type").val(destType);

      $("#download").prop("disabled", false);
      outputName = setOutputName(outputName);

      let oldType = destType;
      $("#image-type").on("change", function () {
        destType = $(this).val();

        outputName = getOutputName(outputName, oldType, destType);
        outputName = setOutputName(outputName);
        oldType = destType;

        if (destType == "png" || destType == "bmp") {
          if (!$("#image-quality").prop("disabled")) {
            $("#quality").val(100);
            $("#quality").prop("disabled", true);
            $("#quality-value").val(100);
            $("#quality-value").prop("disabled", true);
            $("#quality-option").addClass("add-pop-up");
          }
        } else {
          if ($("#quality").prop("disabled")) {
            $("#quality").prop("disabled", false);
            $("#quality-value").prop("disabled", false);
          }

          if (destType == "jpg") {
            $("#quality").val(92);
            $("#quality-value").val(92);
          } else if (destType == "webp") {
            $("#quality").val(80);
            $("#quality-value").val(80);
          }

          $("#quality-option").removeClass("add-pop-up");
        }
      });

      let scale = imgWidth / imgHeight;

      $("#width").on("input", function () {
        let newImgWidth = $(this).val();
        let selectUnit = $("#image-unit").val();
        let newImgHeight = Math.round(newImgWidth / scale);

        if (selectUnit == "px") {
          outputWidth = newImgWidth;
          outputHeight = newImgHeight;
        } else if (selectUnit == "in") {
          outputWidth = newImgWidth * 96;
          outputHeight = newImgHeight * 96;
        } else if (selectUnit == "cm") {
          outputWidth = Math.round((newImgWidth * 96) / 2.54);
          outputHeight = Math.round((newImgHeight * 96) / 2.54);
        } else if (selectUnit == "mm") {
          outputWidth = Math.round((newImgWidth * 96) / 25.4);
          outputHeight = Math.round((newImgHeight * 96) / 25.4);
        }

        $("#height").val(newImgHeight);

        canvas.width = outputWidth;
        canvas.height = outputHeight;
        ctx.filter = preFilter;
        ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
      });

      $("#height").on("input", function () {
        let newImgHeight = $(this).val();
        let selectUnit = $("#image-unit").val();
        let newImgWidth = Math.round(newImgHeight * scale);

        if (selectUnit == "px") {
          outputWidth = newImgWidth;
          outputHeight = newImgHeight;
        } else if (selectUnit == "in") {
          outputWidth = newImgWidth * 96;
          outputHeight = newImgHeight * 96;
        } else if (selectUnit == "cm") {
          outputWidth = Math.round((newImgWidth * 96) / 2.54);
          outputHeight = Math.round((newImgHeight * 96) / 2.54);
        } else if (selectUnit == "mm") {
          outputWidth = Math.round((newImgWidth * 96) / 25.4);
          outputHeight = Math.round((newImgHeight * 96) / 25.4);
        }

        $("#width").val(newImgWidth);

        canvas.width = outputWidth;
        canvas.height = outputHeight;
        ctx.filter = preFilter;
        ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
      });

      $("#image-unit").on("change", function () {
        let selectUnit = $(this).val();

        if (selectUnit == "px") {
          $("#width").val(outputWidth);
          $("#height").val(outputHeight);
        } else if (selectUnit == "in") {
          $("#width").val(Math.round(outputWidth / 96));
          $("#height").val(Math.round(outputHeight / 96));
        } else if (selectUnit == "cm") {
          $("#width").val(Math.round((outputWidth * 2.54) / 96));
          $("#height").val(Math.round((outputHeight * 2.54) / 96));
        } else if (selectUnit == "mm") {
          $("#width").val(Math.round((outputWidth * 25.4) / 96));
          $("#height").val(Math.round((outputHeight * 25.4) / 96));
        }
      });

      $("[data-custom-close=modal-export]").on("click", function () {
        $("#download").prop("disabled", true);

        canvas.width = imgWidth;
        canvas.height = imgHeight;
        ctx.filter = preFilter;
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
      });

      $("#render").on("click", function () {
        let ratio = parseInt($("#quality-value").val()) / 100;

        let destMimeType = destType;
        if (destType == "jpg") destMimeType = "jpeg";
        $("#output-size").text("0B");

        initializeProgress($("#progress-render"));

        let renderValue = 0;

        let loadingAnimation = setInterval(function () {
          renderValue++;
          $("#progress-render").val(renderValue);

          if (renderValue == 90) {
            clearInterval(loadingAnimation);
          }
        }, 40);

        canvas.toBlob(
          function (blob) {
            let outputSize = roundBytes(blob.size);
            $("#output-size").text(outputSize);

            let newImageBlob = URL.createObjectURL(blob);
            $(".download-image").attr("src", newImageBlob);
            $("#output-image").attr("src", newImageBlob);

            $("#download").attr("download", outputName);
            $("#download").attr("href", newImageBlob);

            clearInterval(loadingAnimation);
            progressDone($("#progress-render"));
          },
          "image/" + destMimeType,
          ratio
        );
      });
    });
  };
}

$("#navbar").on("click", ".image-tag", function () {
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
  $("#describe-upload").addClass("t-blue");
  $("#icon-upload").addClass("fill-blue");
  $("#upload").click();
});

$("#upload").on("click", function (event) {
  event.stopPropagation();

  document.body.onfocus = function () {
    $("#upload-box").removeClass("m-upload-select");
    $("#describe-upload").removeClass("t-blue");
    $("#icon-upload").removeClass("fill-blue");
  };
});

$("#upload").on("change", function (event) {
  $("#upload-box").removeClass("m-upload-select");
  $("#describe-upload").removeClass("t-blue");
  $("#icon-upload").removeClass("fill-blue");
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
  $("#describe-upload").addClass("t-blue");
  $("#icon-upload").addClass("fill-blue");
});

uploadBox.addEventListener("dragleave", function () {
  this.classList.remove("m-upload-select");
  $("#describe-upload").removeClass("t-blue");
  $("#icon-upload").removeClass("fill-blue");
});

uploadBox.addEventListener("dragover", function () {
  this.classList.add("m-upload-select");
  $("#describe-upload").addClass("t-blue");
  $("#icon-upload").addClass("fill-blue");
});

uploadBox.addEventListener("drop", function (event) {
  this.classList.remove("m-upload-select");
  $("#describe-upload").removeClass("t-blue");
  $("#icon-upload").removeClass("fill-blue");

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

// Show pop up

$("#navbar").on("mouseenter", ".image-tag", function () {
  $(this).children(".pop-up").show();
});

$("#navbar").on("mouseleave", ".image-tag", function () {
  $(this).children(".pop-up").hide();
});

$(".tool").on("mouseenter", function () {
  $(this).children(".pop-up").show();
});

$(".tool").on("mouseleave", function () {
  $(this).children(".pop-up").hide();
});

$(".modal__content").on("mouseenter", ".add-pop-up", function () {
  $(this).children(".pop-up").show();
});

$(".modal__content").on("mouseleave", ".add-pop-up", function () {
  $(this).children(".pop-up").hide();
});
