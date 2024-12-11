
let is_prod = false;


const server= is_prod ?
 "https://conference-3cu1.onrender.com" :
    "http://localhost:8000" 


    console.log(server);
  

export default server;