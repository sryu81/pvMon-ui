# How to install and use 

## Prerequisites
- npm : version > 10.8.2 (my current npm version. I am not sure if it can be lower..)
- Web server (if needed) : Apache or NginX 
  (You never need the web server if you run this on local or small size network)

## How to install ? 

```
npm install package.json
```

## How to run ?
### In Local server

```
npm start
```

NPM will open the website for you using the default web browser.

### In apache server

1. You need to build the package
```
npm run build
```
2. copy the "build" directory contents to /var/www/html/
```
cd build
sudo cp -av * /var/www/html
```
3. Open the web server page. If you don't config anything on the webserver then [localhost](http://localhost) 


# Service dependency
- web server
    - Apache 
    - NginX : I don't know about this.. yet
- influxdb 2.7 or higher
    - docker (for influxdb)

## Apache webserver install and configuration

## InfluxDB install and configuration
### Install Docker

When you're using the docker in the package repository, remove them. 
Visit here: 
- [debian](https://docs.docker.com/engine/install/debian/)
- [ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [centos, rocky](https://docs.docker.com/engine/install/centos/)

### Run Influxdb with docker
```
# Pull and run InfluxDB 2.x
docker run -d \
  --name influxdb \
  -p 8086:8086 \
  -v influxdb-storage:/var/lib/influxdb2 \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=password123 \
  -e DOCKER_INFLUXDB_INIT_ORG=epics-org \
  -e DOCKER_INFLUXDB_INIT_BUCKET=pv-data \
  influxdb:2.7
```
