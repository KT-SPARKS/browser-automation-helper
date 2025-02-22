Sample chrome browser extension to select elements from your browser and copy details about them on a server.

Read more here on in our article here:
https://www.linkedin.com/pulse/release-open-source-concept-automation-helper-chrome-extension-bkkvf

Idea is to utilize the server's scraped data inside headless browser automations like pupeteer. 

To install 

- Enable developer mode in Chrome/Chromium browser
- Load unpacked extension from ./extension 

To set-up server
- Run `npm install` inside ./server 
- Run `npm start` to start the server 
- Load `https://localhost:3000` to browse the scrapped data