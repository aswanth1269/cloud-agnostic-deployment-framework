const express = require("express")

const app = express()

app.get("/", (req,res)=>{
    res.send("Cloud Agnostic Deployment Framework Demo")
})

app.get("/health",(req,res)=>{
    res.json({status:"running"})
})

const PORT = 3000

app.listen(PORT,()=>{
    console.log("Server running on port",PORT)
})
