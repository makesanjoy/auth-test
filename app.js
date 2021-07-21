//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session=require("express-session");
const passport =require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
// const encrypt =require("mongoose-encryption");   //2nd level encryption
// const md5 = require("md5");         //3rd level encryption i.e only hash function
// const bcrypt = require("bcrypt");    //4th level encryption inluded salting with hash
// const saltRounds =10;                //number of salt round we needed more salt round more hard is the computer to work on

const app = express();


app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({
    secret:"this is our little secret.",
    resave:false,
    saveUninitialized:false
}));
app.use(passport.initialize());  //telling app to initialise passport
app.use(passport.session());     //use passpport for dealing with the session

mongoose.connect("mongodb+srv://sanjaysingha:123@Machine@cluster0.dkqwg.mongodb.net/user?retryWrites=true&w=majority", {useNewUrlParser:true});
mongoose.set("useCreateIndex", true);


const userSchema =new mongoose.Schema({     //now this user schema is not only a simple javascript object
    email:String,                           // but an object created from the mongo schema class
    password:String,
    googleId:String,
    secret:String
});
// const profileSchema = new mongoose.Schema({
//     name: String,
//     email:String
// })
// const Profile = new mongoose.model("profile", profileSchema);

userSchema.plugin(passportLocalMongoose);  // hash and salt our password and save it to mongodb
userSchema.plugin(findOrCreate);
// userSchema.plugin(encrypt, {secret:process.env.SECRET, encryptedFields: ["password"] });   //this plugin is neccessary to include before mongoose model as 
                                                //   the model uses the userSchema to add encrypt package as a plug in
const User = new mongoose.model("user", userSchema);   // we  are passing userSchema as a parameter to make mongoose model 

passport.use(User.createStrategy());  //to create a local log in strategy

// passport.serializeUser(User.serializeUser());     //this id for only local mongoose
// passport.deserializeUser(User.deserializeUser());
passport.serializeUser(function(user, done) {     //this serialize works for all
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {   //this is not a mongoose function
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
    res.render("home");
});
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile']
 }));
 app.get('/auth/google/secrets',   // google will automatically redirect to this route
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect secrets page.
    res.redirect('/secrets');
  });

app.get("/login",function(req,res){
    res.render("login");
});
app.get("/register",function(req,res){
    res.render("register");
});
app.get("/secrets",function(req,res){
   User.find({"secret":{$ne:null}},function(err,foundUser){
       if(err){
           console.log(err);
       }else{
           if(foundUser){
res.render("secrets", {usersWithSecrets: foundUser});
           }
       }
   });
});
app.get("/logout",function(req,res){
    req.logout();          //deauthenticating the user as from the syntax from the passport 
    res.redirect("/");
});                    // here the session gets ended and the cookies will all get deleted
app.get("/submit",function(req,res){
     if(req.isAuthenticated()){        //thi checks whether the password is correct or not
        res.render("submit");
    }else{
        res.redirect("/login");
    }
});
app.post("/submit",function(req,res){
const submittedSecret = req.body.secret;

User.findById(req.user.id, function(err, foundUser){
    if(err){
        console.log(err);
    }else{
        if(foundUser){
            foundUser.secret=submittedSecret;
            foundUser.save(function(){
                res.redirect("/secrets");
            });
        }
    }
});
});
app.post("/register",function(req,res){
User.register({username:req.body.username}, req.body.password,function(err,user){    //from passport-local-mongoose syntax fror authentication
    if(err){
        console.log(err);
        res.redirect("/register");
    }else{
        passport.authenticate("local")(req,res, function(){
            res.redirect("/secrets");
        });

    }
});
});


app.post("/login",function(req,res){
const user = new User({
username:req.body.username,
password:req.body.password
});
req.login(user, function(err){               //log in syntax from passport
    if(err){
        console.log(err);
    }else{
        passport.authenticate("local")(req,res,function(){  //Authenticating the user
            res.redirect("/secrets");                        
        });
    }
});

});








 










app.listen(process.env.PORT || 3000,function(){
    console.log("server is running at port 3000");
});
