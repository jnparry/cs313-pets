var express = require("express");
var session = require("express-session");
var bcrypt = require("bcrypt-nodejs");
var app = express();

const connectionString = process.env.DATABASE_URL || "postgres://my_user:my_pass@localhost:5432/pets";
const { Pool } = require('pg');
const pool = new Pool({ connectionString: connectionString });

var timeStamp = Math.floor(Date.now() / 1000);
console.log(timeStamp); // 86400 seconds in a day

var sessionChecker = (req, res, next) => {
    console.log("Session cheker...");
    
    if (!req.session.loggedIn) {
        console.log("Not signed in.");
        res.redirect('/signin.html');
    } else {
        next();
    }    
};

app.set("port", process.env.PORT || 5000)
    .set('views', (__dirname + '/views'))
    .set('view engine', 'ejs')

    .use(express.json())                       // for POST
    .use(express.urlencoded({extended:true}))  // for POST
    .use(express.static(__dirname + "/public"))
    .use(session({ secret: 'kittens' }))

    .get("/getAnimals", sessionChecker, getAnimals) // another way to do this: .get("/video/:id", getVideo)
    .get("/getItems", sessionChecker, getItems)
    .get("/home", sessionChecker, function (req, res) {
        accessDB(req, res);
    })

    .post("/sup", signUp)
    .post("/sin", signIn)
    .post("/newAnimals", sessionChecker, newAnimals)
    .post("/newItems", sessionChecker, newItems)

    .listen(app.get("port"), function() {
    console.log("Listening on port: " + app.get("port"));
})

function newItems(req,res) {
//    if (!req.session.loggedIn)
    
    const iname = req.body.iname;
    const quantity = req.body.quantity;
    
    console.log("Adding new item " + iname + " of quantity " + quantity);

    newItemsDb(iname, quantity, function(error, result) {
        // now we just need to send back the data
        if (error) {
            res.status(500).json({success: false, data: error});
        } else {
            res.status(200).json({item_name: iname, quantity: quantity, succes: true});
        }
    });
}

function newItemsDb(iname, quantity, callback) {
    console.log("Accessing DB to add new item...");
    
    // TODO access DB, insert into it
    
    console.log("Successfully inserted " + iname + " with quantity " + quantity + "into DB.");
    callback (null, iname);
}

function newAnimals(req, res) {
    const aname = req.body.aname;
    const species = req.body.species;
    const id = req.session.user_id;
    
    console.log("Adding new animal of species " + species + " with name: " + aname);

    newAnimalsDb(aname, species, id, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
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
    const pass = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(8), null); // TODO: hash?

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

function accessDB(req, res) {
    const usersId = req.session.user_id;
    console.log("About to access db...");
    
    pullInfoDb(usersId, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
            res.render('pages/home', result);
        }
    });
}

function pullInfoDb(usersId, callback) {    
    console.log("About to access DB pull user info...");
    console.log("User's id is " + usersId);
    
    var sql = "SELECT * FROM animals WHERE usersid = $1";
    var params = [usersId];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("ERROR in query: " + err);
			callback(err, null);
        } else {
            console.log(result.rows);
            
            console.log("Successfully pulled info."); // or redirect to sign in page
            var params = {rows: result.rows};
            callback(null, params);
        }
    });
}

function signIn(req, res) {
    const uname = req.body.name;
    const pass = req.body.password;
    
    console.log("Signing in with username: " + uname);
    
    signInDb(uname, pass, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length < 1) {
            res.status(500).json({success: false, data: error});
        } else {
            if (result) {
                req.session.loggedIn = true;
                req.session.user_id = result;
                console.log("Logged in!");
            }
            res.redirect("/home");
        }
    });
}

function signInDb(uname, pass, callback) {
    console.log("About to access DB to sign in...");
    
    var sql = "SELECT password, id FROM users WHERE username = $1";
    var params = [uname];
    
    pool.query(sql, params, function(err, result) {
        if (err) {
            console.log("Error in query: " + err);
            callback(err, null);
        } else {            
            const dbPass = result.rows[0].password;
            
            if (bcrypt.compareSync(pass, dbPass)) {
                console.log("Match");
                callback(null, result.rows[0].id);
            } else {
                console.log("Don't Match");
                callback(null, false);
            }
        }
    });
}
               
function getAnimals(req, res) {    
    console.log("Getting the animals...");
    
    // Get the id of the animals (from the url)
    const id = req.query.id; // another way to do this: var id = req.params.id;
    
    // now we do a callback function because the DB could take a while
    getAnimalsDb(id, function(error, result) {
        // now we just need to send back the data
        if (error || result == null || result.length != 1) {
            res.status(500).json({success: false, data: error});
        } else {
            res.status(200).json(result[0]);
        }
    });
}

function getAnimalsDb(id, callback) {
    console.log("Looking for person with id: " + id + "...");
    
    pool.query('SELECT * FROM users WHERE id = $1::int', [id], function(err, result) {
        if (err) {
            console.log("ERROR: " + err);
			callback(err, null);
        }
        console.log("Fonud result: " + JSON.stringify(result.rows));
        callback(null, result.rows);
    });
}

function getItems(req, res) {
    const id = req.query.id;
    
    console.log("Getting items...");

    getItemsDb(id, function(error, result) {
        // now we just need to send back the data
        if (error) {
            res.status(500).json({success: false, data: error});
        } else {
            res.status(200).json(result[0]);
        }
    });
}

function getItemsDb(id, callback) {
    console.log("Looking for items for person with id: " + id + "...");
    
    pool.query('SELECT * FROM items WHERE usersId = $1::int', [id], function(err, result) {
        if (err) {
            console.log("ERROR: " + err);
			callback(err, null);
        }
        console.log("Fonud result: " + JSON.stringify(result.rows));
        callback(null, result.rows);
    });
}