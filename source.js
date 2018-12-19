let inputType;
let imageStyle;
let imageTarget;
let sourceData;
let resultData;

const INPUT_TEXT = 'type-text';
const INPUT_JS = 'type-js';
const INPUT_CSS = 'type-css';
const IMAGE_LIGHTEN = 'lighten';
const IMAGE_DARKEN = 'darken';
const TARGET_EXTERNAL = 'external';
const TARGET_INTERNAL = 'internal';

const select = (selector) => document.querySelector(selector);
const selectAll = (selector) => Array.from(document.querySelectorAll(selector));

const toggleVisibility = (selector, isVisibile) => {
  const node = select(selector);
  const visible =
    typeof isVisibile === 'function' ? isVisibile(node) : Boolean(isVisibile);

  if (visible) {
    node.classList.remove('invisible');
  } else {
    node.classList.add('invisible');
  }
};

const getInputData = () => select('#input-data').value;

const getInputType = () => inputType || INPUT_TEXT;

const getImageStyle = () => imageStyle || IMAGE_LIGHTEN;

const getStyleTransform = () =>
  getImageStyle() === IMAGE_LIGHTEN
    ? (value) => value ^ 0xff
    : (value) => value;

const clearData = () => {
  sourceData = '';
  resultData = null;

  select('#output-data').value = '';
  updateUI();
};

const getImageTarget = () => imageTarget || TARGET_EXTERNAL;

const setOutputData = (value) => {
  select('#output-data').value = value;
};

const updateTitle = () => {
  let value;

  switch (getInputType()) {
    case INPUT_JS:
      value = 'JavaScript';
      break;
    case INPUT_CSS:
      value = 'Cascading Style Sheets';
      break;
    default:
      value = 'Text';
      break;
  }

  const title = `${value} to Image Converter`;

  select('title').innerText = title;
  select('#page-title').innerText = title;
};

const updateUI = () => {
  updateTitle();
  const isCode = () => inputType !== INPUT_TEXT;

  toggleVisibility('#target-type-container', isCode);
  toggleVisibility('#output-data-container', isCode);
  toggleVisibility('#clipboard-copy-container', isCode);
  toggleVisibility('#clipboard-button', () => isCode() && !!resultData);
  toggleVisibility('#image-download-container', !!resultData);

  updateResult();
};

const updateResult = () => {
  if (!resultData) return;

  const { url, length } = resultData;

  select('#output-image').src = url;
  select('#output-image-download-link').href = generateDownloadLink(url);

  let generateCodeFn;

  switch (inputType) {
    case INPUT_JS:
      generateCodeFn = generateJSImageCode;
      break;
    case INPUT_CSS:
      generateCodeFn = generateCSSImageCode;
      break;
  }

  let code = '';

  if (generateCodeFn) {
    if (getImageTarget() === TARGET_EXTERNAL) {
      code = generateCodeFn(
        '< - YOUR - IMAGE - URL - >',
        length,
        getImageStyle(),
      );
    } else {
      code = generateCodeFn(url, length, getImageStyle()).replace(/\s+/g, ' ');
    }
  }

  setOutputData(code);
};

const readInputType = () => {
  inputType = selectAll('.source-type-tab').find((node) =>
    node.classList.contains('active'),
  ).id;

  updateUI();
};

const setInputType = (value) => {
  selectAll('.source-type-tab').forEach((node) => {
    if (node.id === value) {
      node.classList.add('active');
    } else {
      node.classList.remove('active');
    }
  });

  readInputType();
};

const readImageStyle = () => {
  imageStyle = select('#image-style-select').selectedOptions.item(0).value;

  updateUI();
};

const setImageStyle = (value) => {
  const selectNode = select('#image-style-select');
  selectNode.selectedIndex = Array.from(selectNode.options).findIndex(
    (option) => option.value === value,
  );

  readImageStyle();
};

const readImageTarget = () => {
  const selectedNode = selectAll('.image-target').find((node) => node.checked);
  imageTarget = selectedNode ? selectedNode.value : TARGET_EXTERNAL;

  updateUI();
};

const setImageTarget = (value) => {
  selectAll('.image-target').forEach((node) => {
    node.checked = node.value === value;
  });

  readImageTarget();
};

const readAll = () => {
  readInputType();
  readImageStyle();
  readImageTarget();
};

const encodeText = (source, toStyle) => {
  const code = new (TextEncoder || TextEncoderLite)('utf-8').encode(source);
  const { length } = code;
  const step = Math.ceil(length / 3);
  const data = new Uint8Array(step * 4);

  for (let index = 0; index < step; index++) {
    const si = index * 3;
    const ti = index * 4;
    data[ti + 0] = toStyle(code[si + 0]);
    data[ti + 1] = toStyle(code[si + 1]);
    data[ti + 2] = toStyle(code[si + 2]);
    /* we don't rely on alpha because lowering it
       affects information in RGB channels in WebKit-based browsers
     */
    data[ti + 3] = 0xff;
  }

  const size = Math.ceil(Math.sqrt(step));
  const image = new ImageData(size, size);
  image.data.set(data, 0);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  context.putImageData(image, 0, 0);

  return {
    url: canvas.toDataURL('image/png', 1),
    data,
    length,
    size,
  };
};

const generateDownloadLink = (imageUrl) =>
  `data:application/octet-stream${imageUrl.substr('data:image/png'.length)}`;

const generateJSImageCode = (url, dataLength, style) => {
  const imageSize = Math.ceil(Math.sqrt(Math.ceil(dataLength / 3)));
  const conversion = style === IMAGE_LIGHTEN ? '^0xFF' : '';

  return `
<div style="visibility: hidden;">
  <canvas width="${imageSize}" height="${imageSize}"></canvas>
  <img
    src="${url}"
    onLoad="const d = new Uint8Array(${dataLength}), c = this.previousElementSibling.getContext('2d');
      c.drawImage(this, 0, 0);
      c.getImageData(0, 0, ${imageSize}, ${imageSize}).data.reduce((ti, v, si) => ((si+1)%4 && (d[ti++] = v${conversion}), ti), 0);
      this.parentElement.remove(); eval(new (TextDecoder || TextDecoderLite)('utf-8').decode(d.slice(0, ${dataLength})));">
</div>`;
};

const generateCSSImageCode = (url, dataLength, style) => {
  const imageSize = Math.ceil(Math.sqrt(Math.ceil(dataLength / 3)));
  const conversion = style === IMAGE_LIGHTEN ? '^0xFF' : '';

  return `
<div style="visibility: hidden;">
  <canvas width="${imageSize}" height="${imageSize}"></canvas>
  <img
    src="${url}"
    onLoad="const d = new Uint8Array(${dataLength}), c = this.previousElementSibling.getContext('2d'),
      n = document.createElement('style'); c.drawImage(this, 0, 0);
      c.getImageData(0, 0, ${imageSize}, ${imageSize}).data.reduce((ti, v, si) => ((si+1)%4 && (d[ti++] = v${conversion}), ti), 0);
      this.parentElement.remove(); n.innerHTML = new (TextDecoder || TextDecoderLite)('utf-8').decode(d.slice(0, ${dataLength}));
      document.body.appendChild(n);">
</div>`;
};

const validateConvertButtonEnabled = () => {
  select('#convert-button').disabled = !getInputData();
};

const convertClickHandler = () => {
  readAll();

  sourceData = getInputData();

  if (sourceData) {
    resultData = encodeText(sourceData, getStyleTransform());
    updateUI();
  }
};

selectAll('.source-type-tab').forEach((node) =>
  node.addEventListener('click', (event) => {
    event.preventDefault();
    setInputType(event.target.id);
  }),
);

select('#input-data').addEventListener('change', () => {
  validateConvertButtonEnabled();
  clearData();
});

select('#image-style-select').addEventListener('change', () => {
  readImageStyle();

  if (resultData) {
    convertClickHandler();
  }
});

selectAll('.image-target').forEach((node) =>
  node.addEventListener('change', readImageTarget),
);

select('#convert-button').addEventListener('click', convertClickHandler);

select('#clipboard-button').addEventListener('click', () =>
  navigator.clipboard.writeText(select('#output-data').value),
);

setInputType(INPUT_JS);
setImageStyle(IMAGE_LIGHTEN);
setImageTarget(TARGET_EXTERNAL);
validateConvertButtonEnabled();
