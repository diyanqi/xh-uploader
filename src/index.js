const sha1 = require('js-sha1');
const axios = require('axios');

module.exports = (ctx) => {
  const handle = async function (ctx) {
    const userConfig = ctx.getConfig('picBed.custom-uploader');
    if (!userConfig) {
      throw new Error('Can\'t find uploader config');
    }
    const url = userConfig.url;
    const headers = userConfig.headers;
    const needFileNameUrl = userConfig.needFileNameUrl;
    const postFileName = userConfig.postFileName;
    const jsonPath = userConfig.jsonPath;

    try {
      let imgList = ctx.output;
      for (let i in imgList) {
        let image = imgList[i].buffer || Buffer.from(imgList[i].base64Image, 'base64');
        if (needFileNameUrl) {
          const fileName = imgList[i].fileName;
          let extension = fileName.split('.').pop();
          let timestamp = Math.floor(new Date().getTime() / 1000);
          let newfilename = sha1(timestamp.toString()) + '.' + extension.toLowerCase();
          const imageUrl = url + '/' + newfilename;

          const options = postOptions(image, imageUrl, postFileName, imgList[i].fileName, headers);
          let res = await uploadToXueHai(options);

          delete imgList[i].base64Image;
          delete imgList[i].buffer;

          if (!jsonPath) {
            imgList[i]['imgUrl'] = res;
          } else {
            const body = JSON.parse(res);
            let imgUrl = body[jsonPath];
            if (imgUrl) {
              imgList[i]['imgUrl'] = imgUrl;
            } else {
              ctx.emit('notification', {
                title: '返回解析失败',
                body: '请检查JsonPath设置'
              });
            }
          }
        }
      }
    } catch (err) {
      if (err.response && err.response.data) {
        const error = err.response.data;
        ctx.emit('notification', {
          title: '上传失败！',
          body: error.error
        });
      }
      throw err;
    }
  };

  const postOptions = (image, url, postFileName, fileName, headers) => {
    const opts = {
      method: 'POST',
      url: url,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      formData: {}
    };
    opts.formData[postFileName] = {};
    opts.formData[postFileName].value = image;
    opts.formData[postFileName].options = {
      filename: fileName
    };
    try {
      headers = JSON.parse(headers);
      for (let key in headers) {
        opts.headers[key] = headers[key];
      }
    } catch (e) {
      ctx.emit('notification', {
        title: 'headers 解析失败！',
        body: e.error
      });
    }

    return opts;
  };

  const uploadToXueHai = async (options) => {
    try {
      const response = await axios(options);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const config = ctx => {
    let userConfig = ctx.getConfig('picBed.custom-uploader') || {};
    return [
      {
        alias: '上传地址',
        name: 'url',
        type: 'input',
        default: userConfig.url || '',
        required: true,
        message: '学海OSS提供的上传地址'
      }
    ];
  };

  const register = () => {
    ctx.helper.uploader.register('xh-uploader', {
      handle,
      name: '学海OSS图床',
      config: config
    });
  };

  return {
    uploader: 'xh-uploader',
    register
  };
};
