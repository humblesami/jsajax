## In test mode:
Totally free, totally open, no conditions applied, no guarantees for anything yet
### Installation
`npm install json-http-client`

or

`yarn add json-http-client`
### Usage

```js
import AjaxClient from '@samiciit/json-http-client'

async my_async_method(){
    let ajax_client = new AjaxClient();
    let resp = await ajax_client.ping('https://google.com');
    //will handle and show status => failed if your network connection failed
    console.log(resp.status);
}`
```