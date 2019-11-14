/*
*       FILL IN EACH FUNCTIONAL TEST BELOW COMPLETELY
*       -----[Keep the tests in the same order!]-----
*       (if additional are added, keep them at the very end!)
*/

var chaiHttp = require('chai-http');
var chai = require('chai');
var assert = chai.assert;
var server = require('../server');

const THREAD_URL = '/api/threads/test-board';
const REPLY_URL = '/api/replies/test-board';
const A_MINUTE = 1000 * 60;

chai.use(chaiHttp);

function hErr(err, next, done) {
  if(err) {
    console.error("Error encountered during testing:",err);
    done()
  } else {
    next();
  }
}
function createThread(next){
  let thread = {
      id: null,
      text: `Post text for Thread`,
      delete_password: `Password for thread`
  };
  
  // create a new thread so we know the PW
  chai.request(server)
    .post(THREAD_URL)
    .send(thread)
    .end((err, res)=>{
      // test the new thread
      hErr(err, ()=>{
        // GET the board page to save the thread id
        chai.request(server)
          .get(THREAD_URL)
          .end((err, res) => {
            hErr(err, ()=> {
              // save the thread id for later
              thread.id = res.body.filter((item)=> item.text === thread.text)[0]._id;

              next(null, thread);
            });
          });
      });
    });
}
function createReply(thread_id, num, next){
  let reply = {
    id: null,
    text: `Post text for Reply on thread id ${thread_id}`,
    delete_password: `Password for reply`
  };
  
  chai.request(server)
    .post(REPLY_URL)
    .send(reply)
    .end((err, res)=>{
      // test the new thread
      hErr(err, ()=>{
        // GET the thread page to save the reply id
        chai.request(server)
          .get(`${REPLY_URL}?thread_id=${thread_id}`)
          .end((err, res) => {
            hErr(err, ()=> {
              // save the reply id for later
              reply.id = res.body.replies.filter((item)=> item.text === reply.text)[0]._id;
              
              next(null, reply);
            });
          });
      });
    });
}

suite('Functional Tests', function() {

  suite('API ROUTING FOR /api/threads/:board', function() {
    
    suite('POST', function() {
      
      test('POST a New Thread', (done) => {
        
        // generic test text + metadata; id to be set later
        let thread = {
          id: null,
          text: "Test issue #1",
          delete_password: "1^K8dr^!4iBA"
        };
        
        // Begin POST test
        chai.request(server)
          .post(THREAD_URL)
          .send({
            text: thread.text,
            delete_password: thread.delete_password
          })
          .end((err, res) => {
            // test the new thread
            hErr(err, done, ()=>{
              assert.equal(res.status, 200, "Status of 200");

              // GET the board page to test the POST functionality
              chai.request(server)
                .get(THREAD_URL)
                .end((err, res) => {
                  hErr(err, done, ()=> {
                    let testThread = res.body[0];
                    // make sure the text matches
                    assert.equal(testThread.text, thread.text, "Retrieved text is equal to submitted text");
                    // save the thread id for later
                    thread.id = testThread._id;
                    // test the created_on & bumped_on Date; they should be:
                      // identical
                    assert.equal(testThread.created_on, testThread.bumped_on, "Created & Bumped Dates are Identical");
                      // +/- 1 minute of now
                    assert.approximately(
                      (new Date(testThread.created_on)).valueOf(), 
                      (new Date()).valueOf(), A_MINUTE, 
                      "Created Date within 1 minute from Current Date");
                    
                    // the Password cannot be tested here; will be tested in DELETE
                      // because: password is stored as a Hash & is not included in GET
                    
                    done();
                  });
                });
            });
          });
      });
      
    });
    
    suite('GET', function() {
      
      test('GET board summary', (done)=>{
        
        // run the GET request for testing
        chai.request(server)
          .get(THREAD_URL)
          .end((err, res)=>{
            hErr(err, done, ()=>{
              assert.equal(res.status, 200, "Status of 200");
              // array should not be longer than 10
              assert.isAtMost(res.body.length, 10, "10 Threads At Most");
              // each thread obj:
              res.body.forEach((thread)=>{
                // replies array should not be longer than 3
                assert.isAtMost(thread.replies.length, 3, "3 Replies At Most");
                // includes replycount
                assert.property(thread, "replycount");
                // does NOT include "reported" or "delete_password" fields
                // on thread object
                assert.notProperty(thread, "reported");
                assert.notProperty(thread, "delete_password");
                // anywhere in replies array
                thread.replies.forEach((reply)=>{
                  assert.notProperty(reply, "reported");
                  assert.notProperty(reply, "delete_password");
                });
              });
              
              done();
            });
          });
      });
      
    });
    
    suite('DELETE', function() {
      
      // test for incorrect password: "incorrect password"
      test('DELETE with Incorrect Password', (done)=>{
        this.timeout(3000);
        createThread((err, thread)=>{
          
          // check DELETE
          chai.request(server)
            .delete(THREAD_URL)
            .send({thread_id: thread.id, delete_password: "100% not the correct password"})
            .end((err, res)=>{
              hErr(err, done, ()=>{
                assert.equal(res.status, 200, "Status of 200");
                assert.equal(res.text, "incorrect password", "deletion unsuccessful");
                
                done();
              });
            });
        });
      });
      
      // test for correct password: "success"
      test('DELETE a Thread Successfully', (done)=>{
        this.timeout(3000);
        createThread((err, thread)=>{
          if(err){console.error(err)}
          // check DELETE
          chai.request(server)
            .delete(THREAD_URL)
            .send({thread_id: thread.id, delete_password: thread.delete_password})
            .end((err, res)=>{
              hErr(err, done, ()=>{
                assert.equal(res.status, 200, "Status of 200");
                assert.equal(res.text, "success", "deletion was successful");

                done();
              });
            });
          
        });
      });
      
    }); 
    
    suite('PUT', function() {
      // this is for reporting a thread
      
      // /api/threads/{board}
        // Response should be "success"
      test("PUT: Reporting a Thread", (done)=>{
        chai.request(server)
          .get(THREAD_URL)
          .end((err, res)=>{
            hErr(err, ()=>{
              
              chai.request(server)
                .get(THREAD_URL)
                .end((err, res)=>{
                  hErr(err, ()=>{
                    let threadId = res.body[0]._id;
                    
                    chai.request(server)
                      .put(THREAD_URL)
                      .send({thread_id: threadId})
                      .end((err, res)=>{
                        hErr(err, ()=>{
                          assert.equal(res.status, 200, "Status of 200");
                          assert.equal(res.text, 'success', 'Report was successful');
                        });
                        done();
                      });
                  });
                });
              
            });
          });
      });
      
    });
    
  });
  
  suite('API ROUTING FOR /api/replies/:board', function() {
    
    // metadata for Reply tests:
    let reply = {
      id: null,
      text: `Post text for Reply 1`,
      delete_password: `Password for reply 1`
    };
    let repliesThreadId = "5daf59218ecd486ed9a630dc";
    let repliesThread;
    
    suite('POST', function() {
      // /api/replies/{board}
      
      test('POST a Reply', (done)=>{
        // first we need to create a thread for our reply
        createThread((err, thread)=>{
          // save the thread data for later:
          repliesThread = thread;
          
          chai.request(server)
            .post(REPLY_URL)
            .send({thread_id: repliesThread.id, text: reply.text, delete_password: reply.delete_password})
            .end((err, res)=>{
              hErr(err, ()=>{
                // GET the thread page to save the reply id
                chai.request(server)
                  .get(`${REPLY_URL}?thread_id=${repliesThread.id}`)
                  .end((err, res) => {
                    hErr(err, ()=> {
                      // save the reply id for later
                      reply.id = res.body.replies.filter((item)=> item.text === reply.text)[0]._id;
                      
                      // perform assertions
                      assert.equal(res.status, 200, "Status of 200");
                      // test the reply's created_on & thread's bumped_on Date; they should be:
                        // +/- 1 minute of each other
                      assert.approximately(
                        (new Date(res.body.replies[0].created_on)).valueOf(), 
                        (new Date(res.body.bumped_on)).valueOf(), A_MINUTE,
                        "Reply Created & Thread Bumped Dates are within 1 minute");
                        // +/- 1 minute of now
                      assert.approximately(
                        (new Date(res.body.replies[0].created_on)).valueOf(), 
                        (new Date()).valueOf(), A_MINUTE, 
                        "Reply's Created Date within 1 minute from Current Date");

                      // don't need to delete anything; will use in future tests.
                      done();
                    });
                  });
              });
            }); // end create reply
        }); // end create thread
      }); // end test: POST a Reply
      
    });
    
    suite('GET', function() {
      // /replies/board?thread_id={thread_id}:
      test('GET all Replies on a Thread', (done)=>{
        chai.request(server)
          .get(`${REPLY_URL}?thread_id=${repliesThreadId}`)
          .end((err, res)=>{
            hErr(err, ()=>{
              assert.equal(res.status, 200, "Status of 200");
              assert.equal(res.body.replies.length, 5, "Thread has 5 replies");
              assert.notProperty(res.body, "reported", "Thread object does NOT include 'reported' field");
              assert.notProperty(res.body, "delete_password", "Thread object does NOT include 'delete_password' field");
              res.body.replies.forEach((reply)=>{
                assert.notProperty(reply, "reported", "Replies on object do NOT include 'reported' field");
                assert.notProperty(reply, "delete_password", "Replies on object do NOT include 'delete_password' field");
              });
            });
            done();
          });
        
      }); // end test
      
    });
    
    suite('PUT', function() {
      // this is for reporting a reply
      
      // /api/replies/{board}
      test('PUT a Report on a Reply', (done)=>{
        chai.request(server)
          .put(REPLY_URL)
          .send({thread_id: repliesThread.id, reply_id: reply.id})
          .end((err, res)=>{
            hErr(err, ()=>{
              assert.equal(res.status, 200, "Status of 200");
              assert.equal(res.text, 'success', "Response should be 'success'");
            });
            
            done();
          });
      });
      
    });
    
    suite('DELETE', function() {
      // test for correct password "success"
      // Use Reply Index: 0
      test('DELETE Reply: Correct Password', (done)=>{
        chai.request(server)
          .delete(REPLY_URL)
          .send({thread_id: repliesThread.id, reply_id: reply.id, delete_password: reply.delete_password})
          .end((err, res)=>{
            hErr(err, ()=>{
              assert.equal(res.status, 200, "Status of 200");
              assert.equal(res.text, "success", "deletion successful");

              done();
            });
          });
      });
      test('DELETE Reply: Text Changed', (done)=>{
        chai.request(server)
          .get(`${REPLY_URL}?thread_id=${repliesThread.id}`)
          .end((err, res)=>{
            hErr(err, ()=>{
              assert.equal(res.status, 200, "Status of 200");
              assert.equal(res.body.replies[0].text, '[deleted]', "Text changed to [deleted]");
              
              done();
            });
          });
      });
      
      // test for "incorrect password"
      // Use Reply Index: 3
      test('DELETE Reply: Incorrect Password', (done)=>{
        chai.request(server)
          .delete(REPLY_URL)
          .send({thread_id: repliesThread.id, reply_id: reply.id, delete_password: "100% not the correct password"})
          .end((err, res)=>{
            // "DELETE with Incorrect Password" is a situation where there should be an error
            //assert.equal(err, "incorrect password");
            assert.equal(res.status, 200, "Status of 200");
            assert.equal(res.text, "incorrect password", "deletion unsuccessful");

            done();
          });
      });
      
      // test for other reply (on same thread) password being used (should be incorrect)
      // Use Reply Id: "5daf593e8ecd486ed9a630df"
      // Use Password from: Reply #5 (which is "5")
      test("DELETE Reply: Other Reply's Password", (done)=>{
        chai.request(server)
          .delete(REPLY_URL)
          .send({thread_id: repliesThreadId, reply_id: "5daf593e8ecd486ed9a630df", delete_password: "5"})
          .end((err, res)=>{
            // "DELETE with Incorrect Password" is a situation where there should be an error
            //assert.equal(err, "incorrect password");
            assert.equal(res.status, 200, "Status of 200");
            assert.equal(res.text, "incorrect password", "deletion unsuccessful");

            done();
          });
      });
    });
    
  });

});