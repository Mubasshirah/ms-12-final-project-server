const express=require ('express');
const app=express();
const cors=require('cors');
const port=process.env.port || 5000;

// middleware
app.use(cors());
app.use(express.json());

app.get('/',(req,res)=>{
    res.send('boss is sitting');
})
app.listen(port,()=>{
    console.log(`restaurant is running on ${port}`)
})