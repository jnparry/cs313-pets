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
        console.log("signed in!");
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
    .get("/updateMoney", sessionChecker, updateMoney)
    .get("/itemsMoney", sessionChecker, itemsMoney)


    .post("/sup", signUp)
    .post("/sin", signIn)
    .post("/newAnimals", sessionChecker, newAnimals)
    .post("/newItems", sessionChecker, newItems)
    .post("/changeAnimalStatus", sessionChecker, feedWater)
    .post("/removeAnimal", sessionChecker, removeAnimal)

    .listen(app.get("port"), function() {
    console.log("Listening on port: " + app.get("port"));
})

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

function updateItems(feed, drink, id, newFood, newWater, callback) {
    console.log("About to change item amount...");

    var sql = null;
    var params = null;
    
    if (feed) {
        sql = "UPDATE users SET food = $1 WHERE id = $2";
        params = [newFood, id];
    } else if (drink) {
        sql = "UPDATE users SET water = $1 WHERE id = $2";
        params = [newWater, id];
    }
    
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

function removeAnimal(req, res) {
    const animalId = req.body.remove;

    removeAnimalDb(animalId, function(error, result) {
        if (error || result == null || result.length < 1) {
//            res.status(500).json({success: false, data: error});
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Cannot remove animal.'});
        } else {
//                req.session.money = result;
//                res.redirect("/newItems");
            res.redirect("/home");
//            res.status(200).json({succes: animalId});
        }
    });
}

function removeAnimalDb(animalId, callback) {
    console.log("Accesesing DB remove animals...");

    var sql = "DELETE FROM animals WHERE id = $1";
    var params = [animalId];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("Error: " + err);
            callback(err, null);
        } else {
            console.log("Successfully removed animal.");
            callback(null, animalId);
        }
    });
}

function feedWater(req, res) {
    const id = req.session.user_id;
    const feed = req.body.feed;
    const drink = req.body.drink;
    
    if (feed && (req.session.food < 1)) {
        res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Not enough food. Purchase more from the store.'});
    } else if (drink && (req.session.water < 1)) {
        res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Not enough water. Purchase more from the store.'});
    } else {
        
        console.log("You have just fed/watered your pet.");
        
        const newFood = (parseInt(req.session.food) - parseInt(1));
        const newWater = (parseInt(req.session.water) - parseInt(1));
        
        updateItems(feed, drink, id, newFood, newWater, function(error, result) {
            if (error) {
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Unable to complete this action.'});
            } else {
             //   
            }
        });

        feedWaterDb(feed, drink, function(error, result) {
           if (error) {
    //           res.status(500).json({success: false, data: error});
               res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Unable to complete this action.'});
           } else {
    //           res.status(200).json({succes:true});
               res.redirect("/home");
           }
        });
    }
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

function itemsMoney(req, res) {
    const sAmount = req.session.money;
    const amount = (sAmount - (2 * req.session.quantity));
    const id = req.session.user_id;
    
    if (amount < 0) {
        res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Insufficient funds.'});
    } else {
        itemsMoneyDb(amount, id, function(error, result) {
            if (error || result == null || result.length < 1) {
    //            res.status(500).json({success: false, data: error});
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Cannot update money.'});
            } else {
                req.session.money = result;
                res.redirect("/home");
    //            res.redirect("/home");
    //            res.status(200).json({succes: true});
            }
        });
    }
}

function itemsMoneyDb(newAmount, id, callback) {
    console.log("Accesesing DB to update money...");
    var intMoney = parseInt(newAmount);
    var sql = "UPDATE users SET money = $1 WHERE id = $2";
    var params = [intMoney, id];
    console.log(params);
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("Error w/ moneys. " + err);
            callback(err, null);
        } else {
            console.log("Successfully changed money amount.");
            callback(null, newAmount);
        }
    });
}

function newItems(req, res) {    
    const waternum = req.body.water;
    const foodnum = req.body.food;
    const id = req.session.user_id;
    
    var sum = null;
    var name = null;
    var quantity = null;
    
    if (waternum) {
        quantity = parseFloat(waternum);
        sum = quantity + parseFloat(req.session.water);
        name = 1;
    }
    else if (foodnum) {
        quantity = parseInt(foodnum);
        sum = quantity + parseInt(req.session.food);
        name = 2;
    }
    else {
        quantity = 0;
        sum = 0;
        name = 0;
    }
    
    if ((req.session.money - (2 * quantity)) < 0)
        redirect("/itemsMoney");
    else {
    
        console.log("Adding new item");

        newItemsDb(name, sum, id, function(error, result) {
            // now we just need to send back the data
            if (error) {
    //            res.status(500).json({success: false, data: error});
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Cannot add new item.'});
            } else {
    //            res.status(200).json({item_name: name, quantity: quantity, succes: true});
    //            res.redirect("/home");
                req.session.quantity = quantity;
    //            res.redirect("/itemsMoney");
                res.redirect("/itemsMoney");
            }
        });
    }
}

function newItemsDb(name, quantity, id, callback) {
    console.log("Accessing DB to add new item...");
    
    var sql = null;
    var params = null;
    
    if (name == 1)
        sql = "UPDATE users SET water = $1 WHERE id = $2";
    else if (name  == 2)
        sql = "UPDATE users SET food = $1 WHERE id = $2";
    
    var params = [quantity, id];
    
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

function updateMoney(req, res) {
    const sAmount = req.session.money;
    const amount = (sAmount - 20);
    const id = req.session.user_id;
    
    if (amount < 0) {
        res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Insufficient funds.'});
    } else {
        updateMoneyDb(amount, id, function(error, result) {
            if (error || result == null || result.length < 1) {
    //            res.status(500).json({success: false, data: error});
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Cannot update money.'});
            } else {
                req.session.money = result;
                console.log("here");
                res.redirect("/home");
    //            res.status(200).json({succes: true});
            }
        });
    }
}

function updateMoneyDb(newAmount, id, callback) {
    console.log("Accesesing DB to update money...");
    var intMoney = parseInt(newAmount);
    var sql = "UPDATE users SET money = $1 WHERE id = $2";
    var params = [intMoney, id];
    console.log(params);
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("Error w/ moneys. " + err);
            callback(err, null);
        } else {
            console.log("Successfully changed money amount.");
            callback(null, newAmount);
        }
    });
}

function newAnimals(req, res) {
    const inputName = req.body.aname;
    const inputSpecies = req.body.species;    
    const aname = inputName.charAt(0).toUpperCase() + inputName.slice(1);
    const species = inputSpecies.charAt(0).toUpperCase() + inputSpecies.slice(1);
    
    const id = req.session.user_id;

    if ((req.session.money - 20) < 0)
        res.redirect("/updateMoney");
    else {
        console.log("Adding new animal of species " + species + " with name: " + aname);

        newAnimalsDb(aname, species, id, function(error, result) {
            // now we just need to send back the data
            if (error || result == null || result.length < 1) {
//                res.status(500).json({success: false, data: error});
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Cannot add new animal.'});
            } else {
//                req.session.money = newMoney;
                res.redirect("/updateMoney");
//                res.status(200).json({succes: true, animal_name: aname, species: species});
            }
        });
    }
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
            console.log("Successfully inserted " + species + " with name " + aname + " into DB.");
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
//            res.status(500).json({success: false, data: error});
            res.render('pages/error', {errorMsg: 'Cannot create user. Must be a unique username.', place: '/signup.html'});
        } else {
            res.redirect("/signin.html");
//            res.status(200).json({success: true, user: result});
        }
    });
}

function signUpDb(uname, pass, callback) {
    console.log("About to access DB to sign up...");
    console.log("Pass is: " + pass);
    
    var sql = "INSERT INTO users(username, password, money, water, food) VALUES($1, $2, $3, $4, $5)";
    var params = [uname, pass, 100, 0, 0];
    
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
//            res.status(500).json({success: false, data: error});
            console.log("error, going home w/ error");
            res.render('pages/error', {errorMsg: 'Cannot retrieve animal information.'});
        } else {
            if (result) {
                req.session.result = result
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: null});
            } else {
                req.session.result = 0;
                res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: null});
            }
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
                var parameters = result.rows;
                callback(null, parameters);
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
//            res.status(500).json({success: false, data: error}); // ERROR - PLEASE TRY AGAIN
            res.render('pages/error', {errorMsg: 'Username or password incorrect.', place: '/signin.html'});
        } else {
            if (result) {
                req.session.loggedIn = true;
                req.session.user_id = result;
                req.session.username = uname;
                req.session.money = result2; // ex: 100 - it's an int
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
        } else if (result.rows[0]) {  
            const dbPass = result.rows[0].password;
            
            if (bcrypt.compareSync(pass, dbPass)) {
                console.log("Match");
                callback(null, result.rows[0].id, result.rows[0].money);
            } else {
                console.log("Don't Match");
                callback(null, false, false);
            }
        } else {
            callback(err, null, null);
        }
    });
}

function getItems (req, res, next) {
    const usersId = req.session.user_id;
    console.log("Getting items...");

    getItemsDb(usersId, function(error, result1, result2) {
        // now we just need to send back the data
        if (error || result1 == null || result1.length < 1 || result2 == null || result2.length < 1) {
//            res.status(500).json({success: false, data: error});
            res.render('pages/home', {rows: req.session.result, username: req.session.username, money: req.session.money, food: req.session.food, water: req.session.water, errorMsg: 'Cannot retrieve items.'});
        } else {
            req.session.water = result1;
            req.session.food = result2;
            res.redirect("/getAnimals");
        }
    });
}

function getItemsDb(id, callback) {
    console.log("Looking for items for person with id: " + id + "...");
    
    var sql = "SELECT water, food FROM users WHERE id = $1";
    var params = [id];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("ERROR: " + err);
			callback(err, null, null);
        } else {
            if (result.rows.length < 1) {
                console.log("No result");
                callback(null, 0, 0);
            } else {
                console.log("Fonud result: " + JSON.stringify(result.rows));
                callback(null, result.rows[0].water, result.rows[0].food);
            }
        }
    });
}