# tailserver
A web application to continuously tail and search log files on both unix and windows systems.

####Features:
* Continuoulsy tail log files on unix and windows systems
* Dynamically highlight lines containing user defined expressions
* Dynamically filter lines containing user defined expressions
* Search expressions on current log files and rotated log files
* List log and rotated log files
* Browse log files
* Download log files
* No log data collection, therefore no need for storage setup

####Instalation:
1. npm install tailserver
1. cd to tailserver folder
1. npm install

####Run and stop:
1. forever start tailserver.js
1. forever top tailserver.js
* If forever is not installed, install with npm install forever
* tailserver logs will be generated on the logs folder

####Configuring logs to tail/search:
* Edit public/data/collections.txt
