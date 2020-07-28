let type = document.getElementById("image-type");
let quality = document.getElementById("image-quality");
let imagePattern = new RegExp("image/(png|jpeg|webp|bmp)");

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

function disableZoomIn() {
  $(".viewer-box").remove();
  $(".zoom-selector").remove();
}

function checkMIME() {
  const fileList = this.files;
  let image = fileList[0];

  let inputSize = image.size;
  let inputName = image.name;
  let inputType = image.type;
  let fileBlob = image.slice(0, 4);

  $("#input-name").text(inputName);
  $("#input-size").text(roundBytes(inputSize));

  // Check mime type
  if (!imagePattern.test(inputType)) {
    alert("Invalid image type");
  } else {
    let reader = new FileReader();
    reader.readAsArrayBuffer(fileBlob);

    reader.onloadend = function (e) {
      if (e.target.readyState === FileReader.DONE) {
        let bytes = new Uint8Array(e.target.result);
        if (check(bytes, MIME[inputType])) {
          if (inputSize > 52428800) {
            alert("File should be <= 50MB");
          } else {
            handleFiles(image);
          }
        } else {
          alert("Invalid image type");
        }
      }
    };
  }
}

function handleFiles(image) {
  $("#panel-upload").addClass("disable");

  let imageBlob = URL.createObjectURL(image);
  $(".upload-image").attr("src", imageBlob);

  $(".beforeafterdefault").cndkbeforeafter({
    mode: "drag",
    beforeTextPosition: "top-left",
    afterTextPosition: "top-right",
  });

  // Create temporary image to get width, height, load event
  let img = document.createElement("img");
  img.src = imageBlob;
  img.style.width = "auto";
  img.style.height = "auto";

  img.onerror = function () {
    URL.revokeObjectURL(this.src);
    console.log("Can not load image");
  };

  img.onload = function (e) {
    let startType = image.type.split("/")[1];
    if (startType == "jpeg") startType = "jpg";

    let imgWidth = e.target.width;
    let imgHeight = e.target.height;
    let scale = imgWidth / imgHeight;

    $("#width").val(imgWidth);
    $("#height").val(imgHeight);

    let canvas = document.createElement("canvas");
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    let ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

    $("#convert").addClass("ready-convert");

    $("#width").on("input", function () {
      let newImgWidth = $(this).val();
      let newImgHeight = newImgWidth / scale;
      $("#height").val(newImgHeight);

      canvas.width = newImgWidth;
      canvas.height = newImgHeight;
      ctx.drawImage(img, 0, 0, newImgWidth, newImgHeight);
    });

    $("#height").on("input", function () {
      let newImgHeight = $(this).val();
      let newImgWidth = newImgHeight * scale;
      $("#width").val(newImgWidth);

      canvas.width = newImgWidth;
      canvas.height = newImgHeight;
      ctx.drawImage(img, 0, 0, newImgWidth, newImgHeight);
    });

    $("#convert").on("click", function () {
      let destType = type.value;
      let ratio = parseInt(quality.value) / 10;

      let newFileName = image.name.replace(startType, destType);

      if (destType == "jpg") destType = "jpeg";

      canvas.toBlob(
        function (blob) {
          let outputSize = roundBytes(blob.size);
          $("#output-name").text(newFileName);
          $("#output-size").text(outputSize);

          let newImageBlob = URL.createObjectURL(blob);
          $(".download-image").attr("src", newImageBlob);
          $(".btn-download").removeClass("disable");

          $("#download").attr("download", newFileName);
          $("#download").attr("href", newImageBlob);
        },
        "image/" + destType,
        ratio
      );
    });
  };
}

$("#btn-upload").on("click", function () {
  $("#upload").click();
});

$("#upload").on("change", checkMIME);

$(".btn-download").on("click", function () {
  $("#download")[0].click();
});

$("#image-type").on("change", function () {
  let destType = $("#image-type option:selected").val();
  if (destType == "png" || destType == "bmp") {
    if (!$("#image-quality").prop("disabled")) {
      $("#image-quality").val(10);
      $("#image-quality").attr("disabled", "disabled");
    }
  } else {
    if ($("#image-quality").prop("disabled")) {
      $("#image-quality").prop("disabled", false);
    }
  }
});

$("#change-preview").on("click", function () {
  if ($(this).hasClass("btn-select")) {
    $("#compare-separate").addClass("disable");
    $("#compare-slider").removeClass("disable");

    $("#zoom-in").addClass("disable");
    $("#zoom-in").removeClass("btn-select");
    disableZoomIn();

    $(this).removeClass("btn-select");
  } else {
    $("#compare-separate").removeClass("disable");
    $("#compare-slider").addClass("disable");

    $("#zoom-in").removeClass("disable");

    $(this).addClass("btn-select");
  }
});

$("#zoom-in").on("click", function () {
  if ($(this).hasClass("btn-select")) {
    disableZoomIn();
    $(this).removeClass("btn-select");
  } else {
    $(function () {
      $(".magnify").jqZoom({
        selectorWidth: 100,
        selectorHeight: 100,
        viewerWidth: 150,
        viewerHeight: 150,
      });
    });
    $(this).addClass("btn-select");
  }
});
