const express = require("express");
const session = require("express-session");
const path = require('path');
const bcrypt = require("bcrypt-nodejs");
var app = express();

// DATABASE_URL
const connectionString = process.env.DATABASE_URL || "postgres://my_user:my_pass@localhost:5432/pets";
const { Pool } = require('pg');
const pool = new Pool({ connectionString: connectionString });

var timeStamp = Math.floor(Date.now() / 1000);
//console.log(timeStamp); // 86400 seconds in a day

var sessionChecker = (req, res, next) => {
    console.log("Session checker...");
    
    if (!req.session.loggedIn) {
        console.log("Not signed in.");
        res.redirect('/signin.html');
    } else {
        next();
    }    
}; // logout req.session.destroy();

app.set("port", process.env.PORT || 5000)
    .set('views', (__dirname + '/views'))
    .set('view engine', 'ejs')

    .use(express.json())                       // for POST
    .use(express.urlencoded({extended:true}))  // for POST
    .use(express.static(__dirname + "/public"))
    .use(session({ 
        secret: 'kittens',
        resave: false,
        saveUninitialized: true
    }))

    .get("/getAnimals", sessionChecker, getAnimals) // another way to do this: .get("/video/:id", getVideo)
    .get("/home", sessionChecker, getItems)
    .get("/signout", signout)
    .get("/resetError", function(req, res) {
        req.session.error = null;
        res.redirect("/home");
    })

    .post("/sup", signUp)
    .post("/sin", signIn)
    .post("/purchase", sessionChecker, newItems)
    .post("/newAnimals", sessionChecker, newAnimals)
    .post("/newItems", sessionChecker, newItems)
    .post("/changeAnimalStatus", sessionChecker, feedWater)

    .listen(app.get("port"), function() {
    console.log("Listening on port: " + app.get("port"));
})

function errorMsg(msg) {
    alert("Error: " + msg);
    window.location.href = "/resetError";
}

function status(id, type) {

    // The rest of this code assumes you are not using a library.
    // It can be made less wordy if you use one.
    var form = document.createElement("form");
    form.setAttribute("method", "port");
    form.setAttribute("action", '/feedWater');

    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", type);
    hiddenField.setAttribute("value", id);

    form.appendChild(hiddenField);

    document.body.appendChild(form);
    form.submit();
}

function signout(req, res) {
    req.session.destroy();
    res.redirect('/signin.html');
}

function feedWater(req, res) {
    const feed = req.body.feed;
    const drink = req.body.drink;
    
    console.log("You have just fed/watered you pet.");
    
    feedWaterDb(feed, drink, function(error, result) {
       if (error) {
           res.status(500).json({success: false, data: error});
       } else {
//           res.status(200).json({succes:true});
           res.redirect("/home");
       }
    });
}

function feedWaterDb(feed, drink, callback) {
    console.log("Accessing DB to change animal status...");
    
    var id = null;
    var sql = null;
    var action = null;
    var timeStamp = Math.floor(Date.now() / 1000);
    
    if (feed) {
        sql = "UPDATE animals SET lastfed = $1 WHERE id = $2";
        id = feed;
    } else if (drink) {
        sql = "UPDATE animals SET lastdrink = $1 WHERE id = $2";
        id = drink;
    }
    
    var params = [timeStamp, id];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("Error in query: " + err);
            callback(err, null);
        } else {   
            console.log("Successfully updated animal's status.");
            callback (null, id);
        }
    });
}

function newItems(req, res) {    
    const waternum = req.body.water;
    const foodnum = req.body.food;
    const id = req.session.user_id;
    
    var name = null;
    var quantity = null;
    
    if (waternum) {
        quantity = waternum;
        name = 'Water';
    }
    else if (foodnum) {
        quantity = foodnum;
        name = 'Food';
    }
    else {
        quantity = 0;
        name = 'Nothin';
    }
    
    console.log("Adding new item");

    newItemsDb(name, quantity, id, function(error, result) {
        // now we just need to send back the data
        if (error) {
            res.status(500).json({success: false, data: error});
        } else {
//            res.status(200).json({item_name: name, quantity: quantity, succes: true});
            res.redirect("/home");
        }
    });
}

function newItemsDb(name, quantity, id, callback) {
    console.log("Accessing DB to add new item...");
    
    var sql = "INSERT INTO items(usersid, name, quantity) VALUES($1, $2, $3)";
    var params = [id, name, quantity];
    
    pool.query(sql, params, function(err, result) {
       if (err) {
           console.log("Error in query: " + err);
           callback(err, null);
       } else {
           console.log("Successfully inserted item into DB.");
           callback(null, name);
       }
    });
}

function updateMoney(newAmount, id) {
    var sql = "UPDATE users SET money = $1 WHERE id = $2";
//    var intMoney = parseInt(newAmount);
//    console.log("INTMONEY: " + intMoney);
    var params = [newAmount, id];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("Error w/ moneys. " + err);
        } else {
            console.log("Successfully changed money amount.");
        }
    });
}

function newAnimals(req, res) {
    const aname = req.body.aname;
    const species = req.body.species;
    const id = req.session.user_id;
    const newMoney = (((req.session.money).slice(1)) - 20.00);
    console.log("NEW MONEY" + newMoney);
    
    if (newMoney < 0) {
        req.session.error = "Insufficient funds.";
        res.redirect("/home");
    }
    
    console.log("Adding new animal of species " + species + " with name: " + aname);

    newAnimalsDb(aname, species, id, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
            updateMoney(newMoney, req.session.id);
            req.session.money = "$" + newMoney + ".00";
            res.redirect("/home");
//            res.status(200).json({succes: true, animal_name: aname, species: species});
        }
    });
}

function newAnimalsDb(aname, species, id, callback) {
    console.log("Accessing DB to add new pet...");
    
    var sql = "INSERT INTO animals(usersid, name, species, ishungry, lastfed, isthirsty, lastdrink) VALUES($1, $2, $3, $4, $5, $6, $7)";
    var params = [id, aname, species, true, null, true, null];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("Error in query: " + err);
            callback(err, null);
        } else {   
            console.log("Successfully inserted " + species + " with name " + aname + "into DB.");
            callback (null, aname);
        }
    });
}

function signUp(req, res) {
    const uname = req.body.name;
    const pass = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(8), null); 

    console.log("Pass is: " + pass);
    
    console.log("Signing up with username: " + uname);
    
    signUpDb(uname, pass, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
            res.redirect("/signin.html");
//            res.status(200).json({success: true, user: result});
        }
    });
}

function signUpDb(uname, pass, callback) {
    console.log("About to access DB to sign up...");
    console.log("Pass is: " + pass);
    
    var sql = "INSERT INTO users(username, password, money) VALUES($1, $2, $3)";
    var params = [uname, pass, 100];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("ERROR in query: " + err);
			callback(err, null);
        } else {
            console.log("Successfully inserted " + uname + " into the system. Please go to the sign in page."); // or redirect to sign in page
            callback(null, uname);
        }
    });
}

function getAnimals(req, res) {
    const usersId = req.session.user_id;
    console.log("About to access db...");
    
    getAnimalsDb(usersId, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
            if (result)
                res.render('pages/home', {rows: result, username: req.session.username, money: req.session.money, items: req.session.items, error: req.session.error}); // {rows: result.rows};
            else
                res.render('pages/home', {rows: 0, username: req.session.username, money: req.session.money, items: req.session.items, error: req.session.error}); // {rows: result.rows};
        }
    });
}

function getAnimalsDb(usersId, callback) {    
    console.log("About to access DB pull user info...");
    console.log("User's id is " + usersId);
    
    var sql = "SELECT * FROM animals WHERE usersid = $1 ORDER BY id";
    var params = [usersId];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("ERROR in query: " + err);
			callback(err, null);
        } else {
            if (result.rows.length < 1) {
                console.log("No result");
                callback(null, 0);
            } else {
                console.log(result.rows);
                console.log("Successfully pulled info."); // or redirect to sign in page
                var params = result.rows;
                callback(null, params);
            }
        }
    });
}

function signIn(req, res) {
    const uname = req.body.name;
    const pass = req.body.password;
    
    console.log("Signing in with username: " + uname);
    
    signInDb(uname, pass, function(error, result, result2) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
            if (result) {
                req.session.loggedIn = true;
                req.session.user_id = result;
                req.session.username = uname;
                req.session.money = result2;
                console.log("Logged in!");
            }
            res.redirect("/home");
        }
    });
}

function signInDb(uname, pass, callback) {
    console.log("About to access DB to sign in...");
    
    var sql = "SELECT password, id, money FROM users WHERE username = $1";
    var params = [uname];
    
    pool.query(sql, params, function(err, result, result2) {
        if (err) {
            console.log("Error in query: " + err);
            callback(err, null, null);
        } else {            
            const dbPass = result.rows[0].password;
            
            if (bcrypt.compareSync(pass, dbPass)) {
                console.log("Match");
                callback(null, result.rows[0].id, result.rows[0].money);
            } else {
                console.log("Don't Match");
                callback(null, false, false);
            }
        }
    });
}

function getItems (req, res, next) {
    const usersId = req.session.user_id;
    console.log("Getting items...");

    getItemsDb(usersId, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
            if (result)
                req.session.items = result;
            res.redirect("/getAnimals");
        }
    });
}

function getItemsDb(id, callback) {
    console.log("Looking for items for person with id: " + id + "...");
    
    var sql = "SELECT name, quantity FROM items WHERE usersId = $1 ORDER BY id";
    var params = [id];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("ERROR: " + err);
			callback(err, null);
        } else {
            if (result.rows.length < 1) {
                console.log("No result");
                callback(null, 0);
            } else {
                console.log("Fonud result: " + JSON.stringify(result.rows));
                callback(null, result.rows);
            }
        }
    });
}