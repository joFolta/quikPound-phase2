module.exports = function(app, passport, db, multer, ObjectId) {

  // normal routes ===============================================================

  // show the home page (will also have our login links)
  app.get('/', function(req, res) {
    res.render('index.ejs');
  });

  // PROFILE SECTION =========================
  app.get('/profile', isLoggedIn, function(req, res) {

    //1.) GET USERNAME
    var uId = ObjectId(req.session.passport.user)
    console.log("req.session.passport",req.session.passport)
    // console.log("uId",uId)
    var uName
    db.collection('users').find({_id: uId}).toArray((err, result) => {
      // console.log("result", result);
      // console.log("result[0].local.username", result[0].local.username);
      if (err) return console.log(err)
      uName = result[0].local.username;
                                            //2.) GET POSTS OF USER
                                            //nested to make sure 1st db.collection runs FIRST
                                            db.collection('posts').find({
                                              username: uName
                                            }).toArray((err, result) => {
                                              if (err) return console.log(err)
                                              res.render('profile.ejs', {
                                                user: req.user,
                                                posts: result
                                              })
                                            })
    })
  })

  // LOGOUT ==============================
  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });


  // message board routes ===============================================================

  // GETS individual posts pages (all rendered with posts.ejs)===========================
  app.get('/posts/:post_id', function(req, res) {
    // console.log("req",req)
    // console.log("req.params.post_id",req.params.post_id);
    console.log("req.params",req.params);
    //req.params is the request's query paramater
    var postId = ObjectId(req.params.post_id)
    db.collection('posts').find({_id: postId}).toArray((err, result) => {
      if (err) return console.log(err)
      res.render('posts.ejs', {
        posts: result
      })
    })
  })


  // POSTS routes ==============================

//---------------------------------------
// IMAGE CODE
//---------------------------------------
var storage = multer.diskStorage({
    //WHERE TO STORE FILE ON SERVER'S HARDDRIVE (RIGHT NOW MY COMPUTER, BUT LATER HEROKU OR DIGITAL OCEAN)
    destination: (req, file, cb) => {
      cb(null, 'public/images/uploads')
    },
    //CREATE FILE NAME
    filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now() + ".png")
    }
});
var upload = multer({storage: storage});

// app.post('/up', upload.single('file-to-upload'), (req, res, next) => {
//     //FILE PATH STORED
//     insertDocuments(db, req, 'images/uploads/' + req.file.filename, () => {
//         //db.close();
//         //res.json({'message': 'File uploaded successfully'});
//         res.redirect('/profile')
//     });
// });

// var insertDocuments = function(db, req, filePath, callback) {
//     // saves to USER (for Profile images)
//     var collection = db.collection('users');
//
//     var uId = ObjectId(req.session.passport.user)
//     collection.findOneAndUpdate({"_id": uId}, {
//       $set: {
//         profileImg: filePath
//       }
//     }, {
//       sort: {_id: -1},
//       upsert: false
//     }, (err, result) => {
//       if (err) return res.send(err)
//       callback(result)
//     })
//     // collection.findOne({"_id": uId}, (err, result) => {
//     //     //{'imagePath' : filePath }
//     //     //assert.equal(err, null);
//     //     callback(result);
//     // });
// }
//---------------------------------------
// IMAGE CODE END
//---------------------------------------

//ADDED-------------------------------------------------------------
// In EJS, name = "file-to-upload", (specifies file)
  app.post('/posts', upload.single('file-to-upload'), (req, res) => {
    //1.) GET USERNAME
    // console.log(req.session.passport.user);
    //get LoggedIn user's username
    //saved to uName
    var uId = ObjectId(req.session.passport.user)
    var uName
    // insertDocuments(db, req, 'images/uploads/' + req.file.filename, () => {});

    db.collection('users').find({_id: uId}).toArray((err, result) => {
      if (err) return console.log(err)
      uName = result[0].local.username;

      //2.) CREATES POSTS OF THAT USER
      //nested to make sure 1st db.collection runs FIRST
                db.collection('posts').save({
                  username: uName,
                  postText: req.body.postText,
                  postImg: `images/uploads/${req.file.filename}`
                }, (err, result) => {
                  if (err) return console.log(err)
                  console.log('saved to database')
                  res.redirect('/profile')
                })
    })
  })


  app.put('/messages', (req, res) => {
    db.collection('messages')
      .findOneAndUpdate({
        name: req.body.name,
        msg: req.body.msg
      }, {
        $set: {
          thumbUp: req.body.thumbUp + 1
        }
      }, {
        sort: {
          _id: -1
        },
        upsert: true
      }, (err, result) => {
        if (err) return res.send(err)
        res.send(result)
      })
  })

  app.delete('/messages', (req, res) => {
    db.collection('messages').findOneAndDelete({
      name: req.body.name,
      msg: req.body.msg
    }, (err, result) => {
      if (err) return res.send(500, err)
      res.send('Message deleted!')
    })
  })

  // =============================================================================
  // AUTHENTICATE (FIRST LOGIN) ==================================================
  // =============================================================================

  // locally --------------------------------
  // LOGIN ===============================
  // show the login form
  app.get('/login', function(req, res) {
    res.render('login.ejs', {
      message: req.flash('loginMessage')
    });
  });

  // process the login form
  app.post('/login', passport.authenticate('local-login', {
    successRedirect: '/profile', // redirect to the secure profile section
    failureRedirect: '/login', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // SIGNUP =================================
  // show the signup form
  app.get('/signup', function(req, res) {
    res.render('signup.ejs', {
      message: req.flash('signupMessage')
    });
  });

  // process the signup form
  app.post('/signup', passport.authenticate('local-signup', {
    successRedirect: '/profile', // redirect to the secure profile section
    failureRedirect: '/signup', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // =============================================================================
  // UNLINK ACCOUNTS =============================================================
  // =============================================================================
  // used to unlink accounts. for social accounts, just remove the token
  // for local account, remove email and password
  // user account will stay active in case they want to reconnect in the future

  // local -----------------------------------
  app.get('/unlink/local', isLoggedIn, function(req, res) {
    var user = req.user;
    user.local.email = undefined;
    user.local.password = undefined;
    user.save(function(err) {
      res.redirect('/profile');
    });
  });

};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  res.redirect('/');
}
