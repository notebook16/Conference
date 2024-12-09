import React from "react";
import { Link } from "react-router-dom"; // Import Link from react-router-dom

export default function LandingPage() {
  return (
    <div className="landing_container">
      <nav>
        <p>Join as guest</p>   
        <br/>
        <div role="button">  
        <Link to="/home">
          <button>join meeting</button>  
        </Link>
      </div>
        <br/>

        <div role="button">
          <button>Login</button> 
        </div>
      </nav>

      <div role="button">  
        <Link to="/auth">
          <button>Get Started</button>  
        </Link>
      </div>
    </div>
  );
}
