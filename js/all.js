const app = {
  data() {
    return {
      mymap: null,
      markers: [],
      longitude: '',
      latitude: '',
      stations: [],
      selectedStationID: '',
      nearbyStations: [],
      service: {
        type: ['YouBike1.0', 'YouBike2.0'],
        status: ['停止營運', '正常營運','暫停營運']
      },
      searchStation: '',
      apiPath: 'https://ptx.transportdata.tw/MOTC/v2/Bike',
    }
  },
  methods: {
    getAuthorizationHeader() {
      //  填入自己 ID、KEY 開始
      let AppID = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF';
      let AppKey = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF';
      //  填入自己 ID、KEY 結束
      let GMTString = new Date().toGMTString();
      let ShaObj = new jsSHA('SHA-1', 'TEXT');
      ShaObj.setHMACKey(AppKey, 'TEXT');
      ShaObj.update('x-date: ' + GMTString);
      let HMAC = ShaObj.getHMAC('B64');
      let Authorization = 'hmac username=\"' + AppID + '\", algorithm=\"hmac-sha1\", headers=\"x-date\", signature=\"' + HMAC + '\"';
      return { 'Authorization': Authorization, 'X-Date': GMTString };
    },
    setMap() {
      this.mymap = L.map('map').setView([51.505, -0.09], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this.mymap);
      
      this.getLocation();
    },
    getLocation() {
      if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            this.longitude = position.coords.longitude;  // 經度
            this.latitude = position.coords.latitude;  // 緯度

            // 重新設定 view 的位置
            this.mymap.setView([this.latitude, this.longitude], 16);
            this.getNearbyStations();
          },
          (e) => {
            console.log(e.message);
          }
        )
      }
    },
    getNearbyStations() {
      let url = `${this.apiPath}/Station/NearBy?$spatialFilter=nearby(${this.latitude}, ${this.longitude}, 500)`;

      if(this.searchStation !== '') {
        url += `&$filter=contains(StationName/Zh_tw, '${this.searchStation}') or contains(StationAddress/Zh_tw, '${this.searchStation}')`;
        this.selectedStationID = '';
      }

      axios.get(url, {
        headers: this.getAuthorizationHeader()
      })
      .then((res) => {
        this.nearbyStations = res.data;
        this.getNearbyAvailables();
      })
      .catch((err) => {
        console.log(err);
      })
    },
    getNearbyAvailables() {
      const url = `${this.apiPath}/Availability/NearBy?$spatialFilter=nearby(${this.latitude}, ${this.longitude}, 500)`;

      axios.get(url, {
        headers: this.getAuthorizationHeader()
      })
      .then((res) => {
        const availables = res.data;
        this.stations = [];

        this.nearbyStations.forEach((item) => {
          availables.forEach((availableItem) => {
            if(item.StationUID === availableItem.StationUID) {
              item.AvailableRentBikes = availableItem.AvailableRentBikes;
              item.AvailableReturnBikes = availableItem.AvailableReturnBikes;
              item.ServiceStatus = this.service.status[availableItem.ServiceStatus];
              item.ServiceTypeName = this.service.type[item.ServiceType - 1];

              if(item.StationName.Zh_tw.indexOf('_') !== -1) {
                const name = item.StationName.Zh_tw.split('_');
                item.StationName.Zh_tw = name[1];
              }

              this.stations.push(item);
            }
          })
        })

        this.setMarkers();
      })
      .catch((err) => {
        console.log(err);
      })
    },
    setMarkers(id = '') {
      // 刪除已存在的 marker
      if(this.markers.length > 0) {
        this.markers.forEach((item) => {
          this.mymap.removeLayer(item);
        })
      }
      
      this.markers = [];
      this.selectedStationID = id ? id : this.selectedStationID;

      this.stations.forEach((item) => {
        // 選取和未選取的樣式設定
        let colors = [];
        let color = '';

        if(item.StationUID === id) {
          colors.push('text-white');
        } else {
          colors.push('bg-white');
        }

        // 顏色依照狀態做判斷
        switch (true) {
          case item.ServiceStatus === '暫停營運':
            color = 'light';
            break;          
          case item.AvailableRentBikes === 0:
            color = 'primary';
            break;
          case item.AvailableReturnBikes === 0:
            color = 'secondary';
            break;
          case item.ServiceStatus === '正常營運':
            color = 'info';
            break;
        }

        if(colors[0] === 'text-white') {
          colors.push(`bg-${color} border-${color}`);
        } else {
          colors.push(`text-${color} border-${color}`);
        }

        color = colors.join(' ');

        const iconStyle = L.divIcon({
          className: '',
          html: `<span class="material-icons border rounded-pill p-4 ${color}">directions_bike</span>`
        });

        const content = `
          <div class="card">
            <div class="card-body">
              <h3 class="h5">${item.StationName.Zh_tw}</h3>
              <h4 class="h6 text-light mb-2">${item.StationAddress.Zh_tw}</h4>
              <p class="h7 m-0">可租借車數：${item.AvailableRentBikes}</p>
              <p class="h7 m-0">可歸還車數：${item.AvailableReturnBikes}</p>
            </div>
          </div>
        `;

        let marker = L.marker([item.StationPosition.PositionLat, item.StationPosition.PositionLon], {icon: iconStyle}).addTo(this.mymap)
        .bindPopup(content);

        marker.uid = item.StationUID;
        this.markers.push(marker);
      })
    },
  },
  mounted() {
    this.setMap();
  }
};

Vue.createApp(app).mount('#app');