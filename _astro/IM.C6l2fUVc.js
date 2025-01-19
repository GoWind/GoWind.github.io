import{r as h}from"./index.Dy6lLLXr.js";var x={exports:{}},v={};/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var f;function g(){if(f)return v;f=1;var t=Symbol.for("react.transitional.element"),l=Symbol.for("react.fragment");function o(c,s,i){var u=null;if(i!==void 0&&(u=""+i),s.key!==void 0&&(u=""+s.key),"key"in s){i={};for(var e in s)e!=="key"&&(i[e]=s[e])}else i=s;return s=i.ref,{$$typeof:t,type:c,key:u,ref:s!==void 0?s:null,props:i}}return v.Fragment=l,v.jsx=o,v.jsxs=o,v}var m;function j(){return m||(m=1,x.exports=g()),x.exports}var a=j();const w=()=>{const[t,l]=h.useState({verticalPerspective:0,horizontalPerspective:0,rotation:0,scale:1,offsetX:0,offsetY:0}),o=h.useRef(null),c=h.useRef(null),s=()=>{const e=o.current,r=e?.getContext("2d"),n=c.current;if(!e||!r||!n)return;e.width=n.width,e.height=n.height,r.fillStyle="#000",r.fillRect(0,0,e.width,e.height),r.save(),r.translate(e.width/2+t.offsetX,e.height/2+t.offsetY),r.rotate(t.rotation*Math.PI/180),r.scale(t.scale,t.scale);const p=t.verticalPerspective/1e3,d=t.horizontalPerspective/1e3;r.transform(1,0,0,1,d*e.width,p*e.height),r.drawImage(n,-n.width/2,-n.height/2,n.width,n.height),r.restore()},i=()=>{const e=o.current;if(!e)return;const r=document.createElement("a");r.download="perspective-corrected.png",r.href=e.toDataURL("image/png"),r.click()},u=e=>{const r=e.target.files[0];if(!r)return;const n=new FileReader;n.onload=p=>{const d=new Image;d.onload=()=>{c.current=d,s()},d.src=p.target?.result},n.readAsDataURL(r)};return h.useEffect(()=>{c.current&&s()},[t]),a.jsxs("div",{className:"max-w-4xl mx-auto p-4",children:[a.jsxs("div",{className:"space-y-4",children:[a.jsx("canvas",{ref:o,className:"w-full border rounded"}),a.jsxs("div",{className:"space-y-2",children:[a.jsxs("div",{children:[a.jsxs("label",{children:["Vertical Perspective: ",t.verticalPerspective]}),a.jsx("input",{type:"range",min:"-100",max:"100",value:t.verticalPerspective,onChange:e=>l({...t,verticalPerspective:parseInt(e.target.value)}),className:"w-full"})]}),a.jsxs("div",{children:[a.jsxs("label",{children:["Horizontal Perspective: ",t.horizontalPerspective]}),a.jsx("input",{type:"range",min:"-100",max:"100",value:t.horizontalPerspective,onChange:e=>l({...t,horizontalPerspective:parseInt(e.target.value)}),className:"w-full"})]}),a.jsxs("div",{children:[a.jsxs("label",{children:["Rotation: ",t.rotation,"°"]}),a.jsx("input",{type:"range",min:"-45",max:"45",value:t.rotation,onChange:e=>l({...t,rotation:parseInt(e.target.value)}),className:"w-full"})]}),a.jsxs("div",{children:[a.jsxs("label",{children:["Scale: ",t.scale.toFixed(2),"x"]}),a.jsx("input",{type:"range",min:"0.5",max:"2",step:"0.1",value:t.scale,onChange:e=>l({...t,scale:parseFloat(e.target.value)}),className:"w-full"})]}),a.jsxs("div",{children:[a.jsxs("label",{children:["Horizontal Offset: ",t.offsetX,"px"]}),a.jsx("input",{type:"range",min:"-200",max:"200",value:t.offsetX,onChange:e=>l({...t,offsetX:parseInt(e.target.value)}),className:"w-full"})]}),a.jsxs("div",{children:[a.jsxs("label",{children:["Vertical Offset: ",t.offsetY,"px"]}),a.jsx("input",{type:"range",min:"-200",max:"200",value:t.offsetY,onChange:e=>l({...t,offsetY:parseInt(e.target.value)}),className:"w-full"})]})]}),a.jsx("button",{onClick:i,className:"px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600",children:"Save Image"})]}),a.jsx("input",{type:"file",accept:"image/*",onChange:u})]})};export{w as default};
