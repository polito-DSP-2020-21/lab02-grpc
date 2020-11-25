'use strict';

const db = require('../components/db');
const Image = require('../components/image');

const PROTO_PATH = __dirname + '/../proto/conversion.proto';
const REMOTE_URL = "localhost:50051";
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
var fs = require('fs');
const { resolve } = require('path');

let packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {keepCase: true,
     longs: String,
     enums: String,
     defaults: true,
     oneofs: true
    });
let vs = grpc.loadPackageDefinition(packageDefinition).conversion;


/**
 * Add a new image to the task
 *
 **/
exports.addImage = function(taskId, file) {
    return new Promise((resolve, reject) => {
      var nameFile = file.filename;
      var nameWithoutExtension = nameFile.substring(0, nameFile.lastIndexOf(".") );
      var extension = nameFile.substring(nameFile.lastIndexOf(".")).replace('.', '');
      if(extension != 'jpg' && extension != 'png' && extension != 'gif'){
        reject("bad_request");
        return;
      }

      // SQL query for the creation of the image
      const sql = 'INSERT INTO images(name) VALUES(?)';
      db.run(sql, [nameWithoutExtension], function(err) {
          if (err) {
              reject(err);
          } else {
            var imageId = this.lastID;
            var imageInstance = new Image(imageId, taskId, nameWithoutExtension);
            // SQL query to associate the image to the task
            const sql2 = 'INSERT INTO taskImages(taskId, imageId) VALUES(?, ?)';
            db.run(sql2, [taskId, imageId], function(err) {
                if (err) {
                   reject(err);
                } else {
                   resolve(imageInstance);
                }
            });
          }
      });
    });
  }
  
/**
 * Retrieve a image data structure
 *
 **/
exports.getSingleImage = function(imageId, taskId) {
    return new Promise((resolve, reject) => {
      // SQL query for retrieving the imageName and finding if the image exists for that task
      const sql = 'SELECT name FROM images as i, taskImages as t WHERE i.id = t.imageId AND i.id = ? AND t.taskId = ?';
      db.all(sql, [imageId, taskId], function(err, rows) {
        if (err)
            reject(err);
        else if (rows.length === 0)
            reject("not_found");
        else {
            var imageInstance = new Image(imageId, taskId, rows[0].name);
            resolve(imageInstance);
          }
      });
    });
  }


 
  /**
 * Retrieve the file of a single image
 *
 **/
exports.getSingleImageFile = function(imageId, imageType, taskId) {
    return new Promise((resolve, reject) => {

        //retrieve the name of the image from the database
        const sql = 'SELECT name FROM images as i, taskImages as t WHERE i.id = t.imageId AND i.id = ? AND t.taskId = ?';
        db.all(sql, [imageId, taskId], async function(err, rows) {
            if (err)
                reject(err);
            else if (rows.length === 0)
                reject("not_found");
            else {
                var nameNoExtension = rows[0].name;
                
                //add the extension
                var nameFile = nameNoExtension + '.' + imageType;
                var pathFile = __dirname + '/../uploads/' + nameFile;
                
                //check if there is a file saved with the requested media type
                try {
                    if (fs.existsSync(pathFile)) {
                        //send the file back
                        resolve(nameFile);
                    }  
                    
                    else {

                        //otherwise, I must convert the file
                        //I search for a file, with a different extension, saved server-side
                        var imageType2, imageType3;
                        if(imageType == 'png'){
                            imageType2 = 'jpg';
                            imageType3 = 'gif'
                        } else if(imageType == 'jpg'){
                            imageType2 = 'png';
                            imageType3 = 'gif'
                        } else if(imageType == 'gif'){
                            imageType2 = 'jpg';
                            imageType3 = 'png'
                        } 

                        var pathFile2 = './uploads/' + nameNoExtension + '.' + imageType2;
                        var pathFile3 = './uploads/' + nameNoExtension + '.' + imageType3;
                        var pathOriginFile = null;
                        var originType = null;
                        var pathTargetFile = './uploads/' + nameFile;
                        
                        try {
                            if (fs.existsSync(pathFile2)) {
                                pathOriginFile = pathFile2;
                                originType = imageType2;
                            } else if(fs.existsSync(pathFile3)){
                                pathOriginFile = pathFile3;
                                originType = imageType3;
                            }
                        } catch(err) {
                            console.error(err)
                        }

                        if(pathOriginFile == null){
                            reject("not_found");
                        }

                        var result = await convertImage(pathOriginFile, pathTargetFile, originType, imageType);
                        resolve(nameFile);

                        }
                } catch(err) {
                    console.error(err)
                 }
            }
        });


    });
  }


  /**
 * Delete an image from the task
 *
 **/
exports.deleteSingleImage = function(taskId, imageId) {
    return new Promise((resolve, reject) => {

        //I retrieve the image name
        var file
        const sql = 'SELECT name FROM images WHERE id = ?';
        db.all(sql, [imageId], (err, rows) => {
            if(err)
                reject(err);
            else if (rows.length === 0)
                reject("not_found");
            else {
                var nameNoExtension = rows[0].name;
                //DELETE
                //firstly, I delete the image row from the database
                const sql2 = 'DELETE FROM images WHERE id = ?';
                db.run(sql2, [imageId], (err) => {
                    if (err)
                        reject(err);
                    //secondly, I delete the relationship with the task
                    else {
                        const sql3 = 'DELETE FROM taskImages WHERE taskId = ? AND imageId = ?';
                        db.run(sql3, [taskId, imageId], (err) => {
                            if (err)
                                reject(err);
                            //thirdly, I delete the images from the server
                            else {
                                var pathFile1 = './uploads/' + nameNoExtension + '.png';
                                var pathFile2 = './uploads/' + nameNoExtension + '.jpg';
                                var pathFile3 = './uploads/' + nameNoExtension + '.gif';
                                if (fs.existsSync(pathFile1)) {
                                    fs.unlinkSync(pathFile1);
                                }  
                                if (fs.existsSync(pathFile2)) {
                                    fs.unlinkSync(pathFile2);
                                }  
                                if (fs.existsSync(pathFile3)) {
                                    fs.unlinkSync(pathFile3);
                                }  

                                resolve();
                            }
                        });
                }
            });
            }
        });
      });
  }




function convertImage(pathOriginFile, pathTargetFile, originType, targetType) {

    return new Promise((resolve, reject) => {
    
        let client = new vs.Converter(REMOTE_URL, grpc.credentials.createInsecure());
            
        // Open the gRPC communication with the gRPC server
        let channel = client.fileConvert();


        // Set callback to receive back the file
        var wstream = fs.createWriteStream(pathTargetFile); //for now, the name is predefined
        var success = false;
        var error = "";
        channel.on('data', function(data){

            //receive meta data
            if(data.meta != undefined){
                success = data.meta.success;
                
                if(success == false){
                    error = data.meta.error;
                    reject(error);
                }
            }

            //receive file chunck
            if(data.file != undefined){
                wstream.write(data.file);
            }

        });

        // Set callback to end the communication and close the write stream 
        channel.on('end',function(){
            wstream.end();
        })
                    
        // Send the conversion types for the file (when the gRPC client is integrated with the server of Lab01, the file_type_origin and file_type_target will be chosen by the user)
        channel.write({ "meta": {"file_type_origin": originType, "file_type_target": targetType}});

        // Send the file
        const max_chunk_size = 1024; //1KB
        const imageDataStream = fs.createReadStream(pathOriginFile, {highWaterMark: max_chunk_size});
       
        imageDataStream.on('data', (chunk) => {
            channel.write({"file": chunk });
        });

        // When all the chunks of the image have been sent, the clients stops to use the gRPC channel from the sender side
        imageDataStream.on('end', () => {
            channel.end();
        });

        // Only after the write stream is closed,the promise is resolved (otherwise race conditions might happen)
        wstream.on('close',function(){
            resolve();
        })
    });

}

