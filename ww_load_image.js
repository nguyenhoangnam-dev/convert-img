self.addEventListener("message", async function (e) {
  const data = e.data;
  data[0].toBlob(
    function (blob) {
      self.postMessage({
        blob,
      });
    },
    data[1],
    data[2]
  );
});
