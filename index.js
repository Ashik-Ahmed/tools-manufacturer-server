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
        const orderCollection = client.db("tool-house").collection("orders");


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
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, token });
        })


        //get all users
        app.get('/users', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query);
            const users = await cursor.toArray();
            res.send(users);
        });

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
            console.log(updatedUser)
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

        //get a single product
        app.get('/tools/:id', verifyJWT, async (req, res) => {
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

        //  add a new order
        app.post('/confirm-order', async (req, res) => {
            const newOrder = req.body;
            const result = await orderCollection.insertOne(newOrder);
            res.send(result)
        });


        // get orders by user email... below is with JWT 
        // app.get('/myOrder', async (req, res) => {
        //     const email = req.query.email;
        //     const query = { customerEmail: email };
        //     const cursor = orderCollection.find(query);
        //     const products = await cursor.toArray();
        //     res.send(products);
        // })

        // get orders by user email 
        app.get('/myOrder', verifyJWT, async (req, res) => {

            const authHeader = req.headers.authorization;
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email === decodedEmail) {
                const query = { customerEmail: email };
                const cursor = orderCollection.find(query);
                const orders = await cursor.toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

        })


        // delete an order by id 
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })


        // find a specific order by id for payment 
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const tool = await orderCollection.findOne(query);
            res.send(tool);
        })


        // payment api
        app.post("/create-payment-intent", async (req, res) => {
            const order = req.body;
            const price = parseInt(order.price) * parseInt(order.quantity);
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

            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
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