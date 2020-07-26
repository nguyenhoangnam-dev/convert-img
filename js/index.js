let type = document.getElementById("image-type");
let quality = document.getElementById("image-quality");

function roundBytes(bytes) {
  if (bytes >= 1048576) return Math.round((bytes / 1048576) * 10) / 10 + "MB";
  else if (bytes >= 1024) return Math.round((bytes / 1024) * 10) / 10 + "KB";
  else return bytes + "B";
}

function handleFiles() {
  $("#panel-upload").addClass("disable");

  const fileList = this.files;
  let image = fileList[0];

  let inputSize = image.size;
  let inputName = image.name;

  $("#input-name").text(inputName);
  $("#input-size").text(roundBytes(inputSize));

  let imagePattern = new RegExp("image/(png|jpeg|webp|bmp)");

  if (!imagePattern.test(image.type)) {
    console.log("This file is not an image");
  } else {
    let imageBlob = URL.createObjectURL(image);
    $("#upload-image").attr("src", imageBlob);

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
            $("#download-image").attr("src", newImageBlob);
            $("#btn-download").removeClass("disable");

            $("#download").attr("download", newFileName);
            $("#download").attr("href", newImageBlob);
          },
          "image/" + destType,
          ratio
        );
      });
    };
  }
}

$("#btn-upload").on("click", function () {
  $("#upload").click();
});

$("#upload").on("change", handleFiles);

$("#btn-download").on("click", function () {
  $("#download")[0].click();
});
