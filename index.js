const express=require ('express');
const app=express();
require('dotenv').config();
const cors=require('cors');
const jwt = require('jsonwebtoken');
const stripe=require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port=process.env.port || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT=(req,res,next)=>{
  const authorization=req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error:true,message:'unauthorized access'});
  }
  // bearer token
  const token=authorization.split(' ')[1];
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({error:true,message:'unauthorized and cant decode'})
    }
    req.decoded=decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lilwv8k.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
const menuCollection=client.db('restaurantDb').collection('menu');
const userCollection=client.db('restaurantDb').collection('users');
const reviewCollection=client.db('restaurantDb').collection('review');
const cartCollection=client.db('restaurantDb').collection('carts');
const paymentCollection=client.db('restaurantDb').collection('payments');

// jwt
app.post('/jwt',(req,res)=>{
  const user=req.body;
  const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1hr'});
  res.send({token});
})
// jwt
// verify admin
const verifyAdmin=async(req,res,next)=>{
  const email=req.decoded.email;
  const query={email:email};
  const user=await userCollection.findOne(query);
  if(user?.role !== 'admin'){
    return res.status(403).send({error:true,message:'forbidden message'});
  }
  next();
}
// verify admin

// userCollection
app.get('/users',verifyJWT,verifyAdmin,async(req,res)=>{
  const result=await userCollection.find().toArray();
  res.send(result);
})
app.post('/users',async(req,res)=>{
  const user=req.body;
  const query={email:user.email};
  const existing=await userCollection.findOne(query);
  if(existing){
    return res.send({message:'user already exist'})
  }
  const result=await userCollection.insertOne(user);
  res.send(result);
})


app.patch('/users/admin/:id',async(req,res)=>{
  const id=req.params.id;
  const filter={_id: new ObjectId(id)};
  const updateDoc={
    $set:{
      role: 'admin'
    },
  };
  const result=await userCollection.updateOne(filter,updateDoc);
res.send(result);
})

app.delete('/users/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id: new ObjectId(id)};
  const result=await userCollection.deleteOne(query);
  res.send(result);
})
// verify jwt
// email same
// isAdmin
app.get('/users/admin/:email',verifyJWT, async(req,res)=>{
  const email=req.params.email;
  const decodedEmail=req.decoded.email;
  if(decodedEmail !== email){
    res.send({admin:false})
  }
  const query={email:email}
  const user=await userCollection.findOne(query);
  const result={admin: user?.role==='admin'};
  res.send(result);
})

// data gulo mongodb te collection baniye manually copy paste koresi
// menuCollection
app.get('/menu',async(req,res)=>{
   const result=await menuCollection.find().toArray();
   res.send(result);
})

app.post('/menu',verifyJWT,verifyAdmin,async(req,res)=>{
  const newItem=req.body;
  const result=await menuCollection.insertOne(newItem);
  res.send(result)
});

app.delete('/menu/:id',verifyJWT,verifyAdmin,async(req,res)=>{
  const id=req.params.id;
  const query={_id: new ObjectId(id)};
  const result=await menuCollection.deleteOne(query);
  res.send(result);
})
// menuCollection
 app.get('/review',async(req,res)=>{
    const result=await reviewCollection.find().toArray();
    res.send(result);
 })
 // data gulo mongodb te collection baniye manually copy paste koresi

//  cart collection
app.get('/carts',verifyJWT, async(req,res)=>{
  const email=req.query.email;
  console.log(email);
  if(!email){
    res.send([])
  }
  const decodedEmail=req.decoded.email;
  if(email !==decodedEmail){
    return res.status(403).send({error:true,message:'forbidden access'})
  }
  const query={email:email};
  const result=await cartCollection.find(query).toArray();
  res.send(result);
})
app.post('/carts',async(req,res)=>{
  const item=req.body;
  console.log(item);
  const result=await cartCollection.insertOne(item);
  res.send(result);
})
app.delete('/carts/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id: new ObjectId(id)};
  const result=await cartCollection.deleteOne(query);
  res.send(result);
})
// cart collection

// create payment intent
app.post('/create-payment-intent',verifyJWT,async(req,res)=>{
  const {price}=req.body;
  const amount=parseInt(price*100);
  const paymentIntent=await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types:['card']
  });
  res.send({
    clientSecret: paymentIntent.client_secret 
  })
})

// create payment intent

// paymentCollection
// ata time payment e add korte hbe and cart thk delete kore dite hbe
app.post('/payments',verifyJWT,async(req,res)=>{
  const payment=req.body;
  const insertedResult=await paymentCollection.insertOne(payment);
  // delete purpose
  const query={_id: {$in: payment.cartItems.map(id=>new ObjectId(id))}}
  const deletedResult=await cartCollection.deleteMany(query);
  res.send({insertedResult,deletedResult});

})
// paymentCollection


// admin stats
app.get('/admin-stats',verifyJWT,verifyAdmin,async(req,res)=>{
  const users=await userCollection.estimatedDocumentCount();
  const products=await menuCollection.estimatedDocumentCount();
  const orders=await paymentCollection.estimatedDocumentCount();
  const payments=await paymentCollection.find().toArray();
  const revenue=payments.reduce((sum,payment)=>sum+payment.price,0);
  res.send({
    revenue,
    users,
    orders,
    products
  })
})
// admin stats

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('boss is sitting');
})

app.listen(port,()=>{
    console.log(`restaurant is running on ${port}`)
})