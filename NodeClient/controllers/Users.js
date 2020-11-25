'use strict';

var utils = require('../utils/writer.js');
var Users = require('../service/UsersService');
var authErrorObj = { errors: [{ 'param': 'Server', 'msg': 'Authorization error' }] };
var jsonwebtoken = require('jsonwebtoken');
var jwtSecret = '6xvL4xkAAbG49hcXf5GIYSvkDICiUAR6EdR5dLdwW7hMzUjjMUe9t6M5kSAYxsvX';
const expireTime = 604800; //seconds

module.exports.authenticateUser = function authenticateUser (req, res, next) {
  
  if(req.query.type == "login"){
    const email = req.body.email;
    const password = req.body.password;
    Users.getUserByEmail(email)
          .then((user) => {
              if (user === undefined) {
                  utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': 'Invalid e-mail' }],}, 404);
              } else {
                  if (!Users.checkPassword(user, password)) {
                    utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': 'Wrong password' }],}, 401);
                  } else {
                      const token = jsonwebtoken.sign({ user: user.id }, jwtSecret, { expiresIn: expireTime });
                      res.cookie('token', token, { httpOnly: true, sameSite: true, maxAge: 1000 * expireTime });
                      res.json({ id: user.id, name: user.name });
                  }
              }
          }).catch(
              // Delay response when wrong user/pass is sent to avoid fast guessing attempts
              (err) => {
                  new Promise((resolve) => { setTimeout(resolve, 1000) }).then(() => res.status(401).json(authErrorObj))
              }
          );
    }
    
    else if(req.query.type == "logout"){
      res.clearCookie('token').end();
    }

    else{
      utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': "value for the query parameter not accepted" }],}, 400);
    }

  };

module.exports.getUsers = function getUsers (req, res, next) {
    Users.getUsers()
      .then(function (response) {
        utils.writeJson(res, response);
      })
      .catch(function (response) {
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': response }],}, 500);
      });
  };

module.exports.getSingleUser = function getSingleUser (req, res, next) {
    Users.getSingleUser(req.params.userId)
      .then(function (response) {
        if(!response){
          utils.writeJson(res, response, 404);
       } else {
         utils.writeJson(res, response);
      }
      })
      .catch(function (response) {
        utils.writeJson(res, {errors: [{ 'param': 'Server', 'msg': response }],}, 500);
      });
  };


