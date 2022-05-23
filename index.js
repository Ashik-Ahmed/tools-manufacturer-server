const express = require('express');
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const app = express();


//use middleware
app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        console.log('Decoded', decoded);
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m12jl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("tool-house").collection("tools");
        const reviewCollection = client.db("tool-house").collection("reviews");
        const userCollection = client.db("tool-house").collection("users");


        // add a new user 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };

            const updatedDoc = {
                $set: user,
            };

            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //get an specific user by email
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }

            const result = await userCollection.findOne(filter);
            res.send(result);
        })

        // update an user 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const updatedUser = req.body;
            const filter = { email: email };

            const updatedDoc = {
                $set: {
                    updatedUser,
                }
            };

            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        //get all products
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });

        //get a single product to update
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const result = await toolsCollection.findOne(query);
            res.send(result);
        })

        // delete a product by id 
        app.delete('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        })

        // find a specific item by id for payment 
        app.get('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        })


        // payment api
        app.post("/create-payment-intent", async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // update paid status 
        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const payment = req.body;

            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                }
            }

            const updatedOrder = await toolsCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        })




        // add a new review 
        app.post('/addReview', async (req, res) => {
            const newReview = req.body;
            const result = await reviewCollection.insertOne(newReview);
            res.send(result)
        });


    }

    finally {
        // await client.close();
    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Tools house Server is Running");
})

app.listen(port, () => {
    console.log("CRUD server is running on console");
})