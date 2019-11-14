/*
*       Complete the API routing below
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var bCrypt = require('bcrypt');

let boardsHandler = {};

MongoClient.connect(process.env.DB, {useNewUrlParser:true, useUnifiedTopology:true}, (err, client)=> {
  const db = client.db('test');
  
  boardsHandler.postThread = (board, text, delete_password, done) => {
    db.collection('board-'+board).insertOne({
      _id: new ObjectId(),
      text: text,
      delete_password: bCrypt.hashSync(delete_password,12),
      created_on: new Date(),
      bumped_on: new Date(),
      reported: false,
      replies: []
    }, (err,doc)=>{
      if(err){
        done(err);
      } else {
        done(null, doc.ops);
      }
    });
  };
  
  boardsHandler.postReply = (board, thread_id, text, delete_password, done) => {
    db.collection('board-'+board).findOneAndUpdate({_id: new ObjectId(thread_id)}, {
      $push: { replies:{
        _id: new ObjectId(),
        text: text,
        created_on: new Date(),
        delete_password: bCrypt.hashSync(delete_password,12),
        reported: false
      } },
      $set: {
        bumped_on: new Date()
      }
    }, {returnOriginal: false}, (err,doc)=>{
      if(err){
        done(err);
      } else {
        done(null, doc.ops);
      }
    });
  };
  
  boardsHandler.getThreads = (board, done) => {
    let recentThreads = [];
    let docNum = 0;
    db.collection('board-'+board).find(
      {}, 
      {
        sort: {bumped_on:-1}, 
        projection: {
          'delete_password': 0, 
          'reported': 0, 
          'replies.delete_password': 0, 
          'replies.reported': 0
        }
      }).forEach((doc)=>{
      // only 10 most recent threads handled by:
        // sort: {bumped_on:-1} in the .find() command, above
        // if(docNum < 10), below
      // only 3 most recent replies is handled in if(doc.replycount > 3), below
      
      if(docNum < 10){
        doc.replycount = doc.replies.length;
        if(doc.replycount > 3){
          doc.replies.sort((a, b) => a.created_on.valueOf() > b.created_on.valueOf() ? a : b);
          doc.replies = [doc.replies[0], doc.replies[1], doc.replies[2]];
        }
        recentThreads.push(doc);
        docNum++;
      }
    }, (err)=> {
      if(err){
        done(err);
      } else {
        done(null, recentThreads);
      }
    });
  };
  
  boardsHandler.getThreadWithReplies = (board, thread_id, done) => {
    db.collection('board-'+board).findOne(
      {_id: new ObjectId(thread_id)}, 
      {
        projection: {
          'delete_password': 0, 
          'reported': 0, 
          'replies.delete_password': 0, 
          'replies.reported': 0
        }
      }, (err,doc)=> {
      if(err){
        done(err);
      } else {
        done(null, doc);
      }
    });
  };
  
  boardsHandler.reportThread = (board, thread_id, done) => {
    // PUT
    db.collection('board-'+board).findOneAndUpdate(
      {_id: new ObjectId(thread_id)}, 
      {$set: {reported: true}}, 
      {returnOriginal: false}, (err,doc)=>{
      if(err){
        done(err);
      } else {
        done(null, 'success');
      }
    });
  };
  
  boardsHandler.reportReply = (board, thread_id, reply_id, done) => {
    // PUT
    db.collection('board-'+board).findOneAndUpdate(
      {_id: new ObjectId(thread_id)}, 
      {$set: {"replies.$[reportedReply].reported": true}}, 
      {returnOriginal: false, arrayFilters: [ {'reportedReply._id': new ObjectId(reply_id)} ]}, (err,doc)=>{
      if(err){
        done(err);
      } else {
        done(null, 'success');
      }
    });
  };
  
  boardsHandler.deleteThread = (board, thread_id, delete_password, done) => {
    db.collection('board-'+board).findOne({_id: new ObjectId(thread_id)}, (err,doc)=>{
      if(err){
        done(err);
      } else {
        if(bCrypt.compareSync(delete_password, doc.delete_password)){
      db.collection('board-'+board).findOneAndDelete({_id: new ObjectId(thread_id)}, (err,doc)=>{
        if(err){
          done(err);
        } else {
          done(null, 'success');
        }
      });
        } else {
          done('incorrect password');
        }
      }
    });
  };
  
  boardsHandler.deleteReply = (board, thread_id, reply_id, delete_password, done) => {
    db.collection('board-'+board).findOne({_id:new ObjectId(thread_id), 'replies._id': new ObjectId(reply_id)}, {'replies.$':1}, (err,doc)=>{
      if(err){
        done(err);
      } else {
        let index;
        doc.replies.forEach((reply,i)=>{
          if(reply._id == reply_id){
            index = i;
          }
        });
        bCrypt.compare(delete_password, doc.replies[index].delete_password).then((same)=>{
          if(same){
            db.collection('board-'+board).findOneAndUpdate(
              {_id: new ObjectId(thread_id)}, 
              {$set: {"replies.$[deleteReply].text": '[deleted]'}},
              {returnOriginal: false, arrayFilters: [ {'deleteReply._id': new ObjectId(reply_id)} ]}, (err,doc)=>{
                if(err){
                  done(err);
                } else {
                  done(null, 'success');
                }
              });
            } else {
              done('incorrect password');
            }
        });
      }
    });
  };
  
});

module.exports = function (app) {
  
  app.route('/api/threads/:board')
  .post((req,res)=>{
    let board = req.params.board;
    let text = req.body.text;
    let delete_password = req.body.delete_password;
    
    boardsHandler.postThread(board, text, delete_password, (err,data)=>{
      if(err){
        console.error("Error in Thread POST");
        res.send(err);
      } else {
        res.redirect('/b/'+board+"/");
      }
    });
  })
  .get((req,res)=>{
    let board = req.params.board;
    
    boardsHandler.getThreads(board, (err,data)=>{
      if(err){
        console.error("Error in Thread GET", err);
        res.send(err);
      } else {
        res.send(data);
      }
    });
  })
  .put((req,res)=>{
    let board = req.params.board;
    let thread_id = req.body.report_id;
    
    boardsHandler.reportThread(board, thread_id, (err,data)=>{
      if(err){
        console.error("Error in Thread PUT (report)");
        res.send(err);
      } else {
        res.send(data);
      }
    });
  })
  .delete((req,res)=>{
    let board = req.params.board;
    let thread_id = req.body.thread_id;
    let delete_password = req.body.delete_password;
    
    boardsHandler.deleteThread(board, thread_id, delete_password, (err,data)=>{
      if(err){
        console.error("Error in Thread DELETE:",err);
        res.send(err);
      } else {
        res.send(data);
      }
    })
  });
    
  app.route('/api/replies/:board')
  .post((req,res)=>{
    let board = req.params.board;
    let thread_id = req.body.thread_id;
    let text = req.body.text;
    let delete_password = req.body.delete_password;
    
    boardsHandler.postReply(board, thread_id, text, delete_password, (err,data)=>{
      if(err){
        console.error("Error in Reply POST");
        res.send(err);
      } else {
        res.redirect('/b/'+board+'/'+thread_id);
      }
    });
    
  })
  .get((req,res)=>{
    let board = req.params.board;
    let thread_id = req.query.thread_id;
    
    boardsHandler.getThreadWithReplies(board, thread_id, (err,data)=>{
      if(err){
        console.error("Error in Reply GET");
        res.send(err);
      } else {
        res.send(data);
      }
    });
  })
  .put((req,res)=>{
    let board = req.params.board;
    let thread_id = req.body.thread_id;
    let reply_id = req.body.reply_id;
    
    boardsHandler.reportReply(board, thread_id, reply_id, (err,data)=>{
      if(err){
        console.error("Error in Reply PUT (report)", err);
        res.send(err);
      } else {
        res.send(data);
      }
    });
  })
  .delete((req,res)=>{
    let board = req.params.board;
    let thread_id = req.body.thread_id;
    let reply_id = req.body.reply_id;
    let delete_password = req.body.delete_password;
    
    boardsHandler.deleteReply(board, thread_id, reply_id, delete_password, (err,data)=>{
      if(err){
        console.error("Error in Reply DELETE",err);
        res.send(err);
      } else {
        res.send(data);
      }
    });
  });

};
