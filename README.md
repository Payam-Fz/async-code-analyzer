# JavaScript Async Code Program Analyzer
This is a command line tool that statically analyzes your asynchronous JavaScript code which helps you find issues that are hurting your project’s performance and offers code suggestions on how you can fix them. We chose to do static analysis as we wanted something that could analyze code without needing it to run, that way if your code does take a very long time, you won't have to wait for the code suggestions our program suggests.


### Limitations:
- Static analysis results in overestimation of dependencies
- Doesn't account for sequential mutation of states (e.g. 2 consecutive await which seemingly have no dependency may be working on the same database)
- Only works for promise-based asynchronous code and not callback-based
- Not supporting aliasing
- Doesn't support switch statements

***
### Instructions

This project was successfully run using Node.js v21.7.1, so please ensure your Node version is at least that if you run into issues.

In the project folder, install the required node packages with:
```npm install```

Run the analysis with a command like this:
- Linux/MacOS: ```npm start -- --file-path=example/1-basic.js```
- Windows: ```npm start --- --file-path=example\1-basic.js```

where the file-path argument is the path to the .js file you want to analyse.
You will see the results and suggestions in the console. 
***

### Link to Demo Video
[Please Click Here.](https://drive.google.com/file/d/1Z5zUweMHSl2F0nLy446uQV5YsB_lfVeD/view?usp=sharing)
***
### Authors
- Chen, Elias
- Ford, Sean
- Forouzandeh, Payam
- Ho, Angus
- Li, Sarah
