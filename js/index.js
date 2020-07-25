function roundBytes(bytes) {
  if (bytes >= 1048576) return Math.round((bytes / 1048576) * 10) / 10 + "MB";
  else if (bytes >= 1024) return Math.round((bytes / 1024) * 10) / 10 + "KB";
  else return bytes + "B";
}

function handleFiles() {
  const fileList = this.files;
  let image = fileList[0];

  let inputSize = roundBytes(image.size);
  let inputName = image.name;
  $("#input-name").text(inputName);
  $("#input-size").text(inputSize);

  let imagePattern = new RegExp("image/(png|jpeg|webp|bmp)");

  if (!imagePattern.test(image.type)) {
    console.log("This file is not an image");
  } else {
    let imageBlob = URL.createObjectURL(image);
    $("#upload-image").css("background-image", `url(${imageBlob})`);

    let img = document.createElement("img");
    img.src = imageBlob;
    img.style.width = "auto";
    img.style.height = "auto";

    img.onload = function (e) {
      $("#upload-image").removeClass("disable");

      let startType = image.type.split("/")[1];
      if (startType == "jpeg") startType = "jpg";

      $("#start-type").text(startType);

      let canvas = document.createElement("canvas");
      canvas.width = e.target.width;
      canvas.height = e.target.height;
      let ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, e.target.width, e.target.height);

      let type = document.getElementById("image-type");
      $("#convert").on("click", function () {
        let destType = type.value;

        let newFileName = image.name.replace(startType, destType);

        if (destType == "jpg") destType = "jpeg";

        canvas.toBlob(
          function (blob) {
            let outputSize = roundBytes(blob.size);
            $("#output-name").text(newFileName);
            $("#output-size").text(outputSize);

            let newImageBlob = URL.createObjectURL(blob);
            $("#download-image").css(
              "background-image",
              `url(${newImageBlob})`
            );
            $("#download-image").removeClass("disable");
            $("#btn-download").removeClass("disable");

            $("#download").attr("download", newFileName);
            $("#download").attr("href", newImageBlob);
          },
          "image/" + destType,
          1
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
