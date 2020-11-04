# Writing an application in Clojurescript

Sections:
- Motivation
- Setup
- Learning
- TODOs


## Motivation
I think Javascript is a very unaesthetic and confusing language.

I absolutely hate all the confusing, jargon/buzzword fueled tooling around the ecosystem.
To a backend developer used to the rather sensible world of package management and build tools like Maven, Javascript's flavor of the day approach to managing products feels like an insult to all the progress made in the world of software management. 

I love Clojure. I would like to use this amazing language to build **web applications**.

### Why web applications?

The fastest way to ship your software directly to users is via the web. Web applications can run anywhere, as browsers exist on all smartphones, laptops and desktops. Unless your application is extremely resource intensive or heavy, you can mostly get away with web applications. 

Clojurescript uses Google's Closure compiler, which seems to do a good job of emitting compact JS.


## Setup

I use [lein](https://leiningen.org) to configure my clojure/script projects

I use  [figwheel](https://github.com/bhauman/lein-figwheel) to configure my clojurescript application.

Fighweel provides nice tools for interactive development (changing and reloading our clojurescript code in the browser) and a simple server to serve requests and files.

**Note**: There are 2 versions of figwheel. I use `lein figwheel` which is the older version of the fighweel tool for this demo.
The newer version [fighwheel](https://figwheel.org/) is fancier The older, but simpler version suits our needs well without getting distracted by all of the confusing tooling around clojurescript/javascript.


1. I use the lein figwheel template to setup my project
`lein new figwheel your-application-name`

2. This would setup our application for some "live" coding. Before that, lets look at the `project.clj` to understand our project setup and **DELETE** stuff to better understand how a Clojurescript with fighweel project works.

3. A minimal setup
```
(defproject haha "0.1.0-SNAPSHOT"
  :description "FIXME: write this!"
  :url "http://example.com/FIXME"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}

  :min-lein-version "2.9.1"

  :dependencies [[org.clojure/clojure "1.10.0"]
                 [org.clojure/clojurescript "1.10.758"]
                 [org.clojure/core.async  "1.2.603"]
                 [cljs-ajax "0.8.0"]
                 [reagent "1.0.0-alpha2"]
                ;;server-side
                [cheshire "5.10.0"]
                [ring/ring-core "1.8.1"]
                [ring/ring-devel "1.8.1"]]

  :plugins [[lein-figwheel "0.5.20"]
            [lein-cljsbuild "1.1.7" :exclusions [[org.clojure/clojure]]]]

  :source-paths ["src-cljs" "src-clj"]

  :cljsbuild {:builds
              [{:id "dev"
                :source-paths ["src-cljs"]

                ;; The presence of a :figwheel configuration here
                ;; will cause figwheel to inject the figwheel client
                ;; into your build
                :figwheel {:on-jsload "haha.core/on-js-reload"
                           ;; :open-urls will pop open your application in the default browser once Figwheel has started and compiled your application.
                          :open-urls ["http://localhost:3449/index.html"]}

                :compiler {:main haha.core
                           ;;:target :bundle
                           :asset-path "js"
                           :output-to "resources/public/js/haha-dev.js"
                           :output-dir "resources/public/js"
                      
                           :source-map-timestamp true
                           ;; To console.log CLJS data-structures make sure you enable devtools in Chrome
                           ;; https://github.com/binaryage/cljs-devtools
                           :preloads [devtools.preload]}}
               ;; This next build is a compressed minified build for
               ;; production. You can build this with:
               ;; lein cljsbuild once min
               {:id "min"
                :source-paths ["src"]
                :compiler {:output-to "resources/public/js/haha.js"
                           :main haha.core
                           :optimizations :advanced
                           :pretty-print false}}]}

  :figwheel { :http-server-root "public" ;; default and assumes "resources"
             ;; :server-port 3449 ;; default
             ;; :server-ip "127.0.0.1"
             :css-dirs ["resources/public/css"] 
             ;; Start an nREPL server into the running figwheel process
             ;; :nrepl-port 7888
             :ring-handler haha-server.server/handler}
```

4. Let us understand the tools in this setup
`lein` uses plugins to extend the functionality of our build tool. `lein-cljsbuild` is a plugin to compile our clojurescript code to Javascript.
`figwheel` is a tool and a plugin, that provides us a nice environment for live coding. It a) watches our source code for changes so that our files can be re-compiled and b) provides a connection to clojurescript environment running on our browser that can be used for executing expressions from our command line repl and is used for re-loading our code. It also provides a watcher for CSS files and can load CSS changes live (pretty cool!)

5. The `cljsbuild` section consists of `builds` each with a possibly different configuration for building our Clojurescript code to Javascript.
6. The `figwheel` configuration provides us a server that we can use for sending responses to AJAX requests from the client and also for injecting the figwheel client into the builds for live re-loading and a REPL session. 

### TODOs
Prod builds
Creating lists
