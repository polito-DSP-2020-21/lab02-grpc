'use strict';

var utils = require('../utils/writer.js');
var fs = require('fs');
var Images = require('../service/ImageService.js');

module.exports.addImage = function addImage (req, res, next) {
  Images.addImage(req.params.taskId, req.file)
    .then(function (response) {
      utils.writeJson(res, response, 201);
    })
    .catch(function (response) {
      if(response == 'bad_request'){
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': 'Unsupported Media Type'}],}, 415);
      } else {
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': response }],}, 500);
      }
    });
};

module.exports.getSingleImage = function getSingleImage (req, res, next) {

  Images.getSingleImage(req.params.imageId, req.params.taskId)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      if(response == 'not_found'){
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': 'Image not found'}],}, 404);
      } else {
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': response }],}, 500);
      }
     
    });
};


module.exports.getSingleImageFile = function getSingleImageFile (req, res, next) {
  
  var mediaType = req.get('Accept');
  if(mediaType != 'image/png' && mediaType != 'image/jpg' && mediaType != 'image/gif'){
    utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': 'Media Type not supported'}],}, 415);
    return;
  }
  var imageType = mediaType.substring(mediaType.lastIndexOf("/") );
  var imageType = imageType.replace('/', '');

  Images.getSingleImageFile(req.params.imageId, imageType, req.params.taskId)
    .then(function (response) {
      res.sendFile(response, {root: './uploads'});
    })
    .catch(function (response) {
      if(response == 'not_found'){
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': 'Image not found'}],}, 404);
      } else {
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': response }],}, 500);
      }
     
    });
};


module.exports.deleteSingleImage = function deleteSingleImage (req, res, next) {
  Images.deleteSingleImage(req.params.taskId, req.params.imageId)
    .then(function (response) {
      utils.writeJson(res, null, 204);
    })
    .catch(function (response) {
      if(response == 'not_found'){
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': 'Image not found'}],}, 404);
      } else {
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': response }],}, 500);
      }
    });
};



