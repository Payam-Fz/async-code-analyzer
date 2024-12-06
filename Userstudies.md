## Summary of User Studies

### First User Studies
We performed the user study on 2 users. We provided a piece of async code and asked them to estimate order of operations, time taken, CPU and Memory usage for that code. Then, we show a screenshot of our visualization to the user and ask them to understand it and give feedback about the information provided.

Summary of User 1 feedback:

    The user has prior experience writing async code in JavaScript and rated themselves 6/10 in this regard.
    Estimation of the operation order: Correct
    Estimation of time: Indecisive
    Estimation of CPU/memory utilization: Indecisive
    How long to understand the graphs: 1min
    Learned anything new after seeing the graphs:
        That the waiting times and executing times look like they can be quite different is interesting.
    Average usefulness of different parts: 9/10
    Average intuitiveness of different parts: 9/10
    Other pieces to include (suggestion from user):
        What the variables were at the different execution steps in the flame graph
        Combine the resources graph with the flame graph might be useful in debugging what executing functions might be causing high resource usage
    Overall score: 9/10

Summary of User 2 feedback:

    - The user has prior experience writing JavaScript but not much with async code. They rated themselves 2/10 in this regard.
    - Estimation of the operation order: Correct
    - Estimation of time: Correct
    - Estimation of CPU/memory utilization: Almost correct
    - How long to understand the graphs: 1min
    - Learned anything new after seeing the graphs:
        - The read file is longer than my estimate
    - Average usefulness of different parts: 7/10
    - Average intuitiveness of different parts: 8/10
    - Other pieces to include (suggestion from user):
        - [Did not have any suggestion]
    - Overall score: 7/10


### Final User studies

User 1

    - Previous experience with JavaScript (JS), somewhat familiar with asynchronous JS code.
    - Identified main bottleneck in the program but missed a smaller piece where a statement didn’t depend on an async operation.
    - Believes the tool would be helpful because it’s easy to forget about optimization.
    - Suggests that newcomers to JS might not know to use Promise.all() or understand its function.

User 2

    - Previous experience with JavaScript, vaguely understands asynchronous JS code.
    - Identified that three fetch calls were being called sequentially even though they didn’t depend on each other, but missed out on code that was blocked from an async function despite not needing to wait for it.
    - Finds the idea interesting and potentially very helpful.
    - Suggests that feedback should be clear with suggestions, akin to ChatGPT responses.
