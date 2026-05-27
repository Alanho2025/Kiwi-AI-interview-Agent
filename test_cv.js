const { buildCvProfile } = require('./backend/src/services/cv/cvProfileBuilderService.js');
const profile = buildCvProfile(`Resume Jo Engineer
Email: jo@engineer.com

Technical Skills
Java
Gained experience in object-oriented programming by developing a game with a GUI.
Python
Learned sockets by developing client and server programs.
Other languages I have used: C, C++, SQL

Project Experience
To Do List project at Victoria University 2020
Currently developing a to-do list application with a GUI using git, Trello and continuous integration.
Key tools / skills
Excel - Project management spreadsheet
Stakeholder management`);
console.log(profile.evidenceProfile.evidenceItems.map(i => i.text));
