import { useEffect, useState, useRef } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from './supabase'

const RAZORPAY_KEY_ID = 'rzp_test_TkGQd9ViCvuSZE'


function DeliveryMapPicker({ initialLocation, onSelect }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const startLat = initialLocation?.latitude ?? 13.311989
    const startLng = initialLocation?.longitude ?? 77.532854

    const map = L.map(mapRef.current).setView([startLat, startLng], 15)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    const marker = L.marker([startLat, startLng], {
      draggable: true
    }).addTo(map)

    const selectPoint = async (lat, lng, knownAddress = '') => {
      marker.setLatLng([lat, lng])
      map.setView([lat, lng], 16)

      let address = knownAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`

      if (!knownAddress) {
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          )

          if (response.ok) {
            const data = await response.json()
            address =
              data.locality ||
              data.city ||
              data.principalSubdivision ||
              address
          }
        } catch (error) {
          console.error('Map reverse geocoding error:', error)
        }
      }

      onSelect({
        address,
        latitude: lat,
        longitude: lng
      })
    }

    map.on('click', (event) => {
      selectPoint(event.latlng.lat, event.latlng.lng)
    })

    marker.on('dragend', () => {
      const position = marker.getLatLng()
      selectPoint(position.lat, position.lng)
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  const searchLocation = async () => {
    const query = searchText.trim()

    if (!query) return

    setSearching(true)
    setSearchResults([])

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(query)}`
      )

      if (!response.ok) {
        throw new Error('Location search failed')
      }

      const data = await response.json()
      setSearchResults(data || [])
    } catch (error) {
      console.error('Location search error:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const chooseSearchResult = (result) => {
    const lat = Number(result.lat)
    const lng = Number(result.lon)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16)

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      }
    }

    setSearchResults([])
    setSearchText(result.display_name)

    onSelect({
      address: result.display_name,
      latitude: lat,
      longitude: lng
    })
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '12px'
      }}>
        <input
          className="checkoutInput"
          type="text"
          placeholder="Search location or address"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              searchLocation()
            }
          }}
          style={{ flex: 1, marginTop: 0 }}
        />

        <button
          type="button"
          className="locationChangeButton"
          onClick={searchLocation}
          disabled={searching}
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {searchResults.map((result) => (
            <button
              type="button"
              key={result.place_id}
              onClick={() => chooseSearchResult(result)}
              style={{
                textAlign: 'left',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                background: '#fff'
              }}
            >
              📍 {result.display_name}
            </button>
          ))}
        </div>
      )}

      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '320px',
          borderRadius: '16px',
          overflow: 'hidden',
          marginTop: '12px'
        }}
      />

      <div style={{
        marginTop: '10px',
        textAlign: 'center',
        fontSize: '14px',
        color: '#666'
      }}>
        📍 Tap the map or move the pin to select delivery location
      </div>
    </div>
  )
}

const defaultShops = [
  {
    id: 1,
    name: 'SIPGO Liquor Store',
    location: 'Doddaballapur',
    time: '20–30 min',
    photo: '',
    products: []
  },
  {
    id: 2,
    name: 'City Wine Store',
    location: 'Doddaballapur',
    time: '15–25 min',
    photo: '',
    products: []
  },
  {
    id: 3,
    name: 'Royal Liquor Store',
    location: 'Doddaballapur',
    time: '25–35 min',
    photo: '',
    products: []
  }
]

function isShopOpen(openingTime, closingTime) {
  if (!openingTime || !closingTime) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [openHour, openMinute] = String(openingTime).slice(0, 5).split(':').map(Number)
  const [closeHour, closeMinute] = String(closingTime).slice(0, 5).split(':').map(Number)

  const openMinutes = openHour * 60 + openMinute
  const closeMinutes = closeHour * 60 + closeMinute

  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  // Supports shops that close after midnight
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

function App() {


  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [pan, setPan] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoggedIn(!!data.session)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
        setIsLoggedIn(!!newSession)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const calculateAge = (birthDate) => {
    const today = new Date()
    const dobDate = new Date(birthDate + 'T00:00:00')

    let age = today.getFullYear() - dobDate.getFullYear()
    const month = today.getMonth() - dobDate.getMonth()

    if (month < 0 || (month === 0 && today.getDate() < dobDate.getDate())) {
      age--
    }

    return age
  }

  const handleSignup = async () => {
    setAuthError('')
    setAuthMessage('')

    const cleanMobile = mobile.replace(/\\D/g, '')
    const cleanPan = pan.trim().toUpperCase()

    if (!name.trim()) {
      setAuthError('Enter your full name')
      return
    }

    if (!dob) {
      setAuthError('Enter your date of birth')
      return
    }

    if (new Date(dob + 'T00:00:00') > new Date()) {
      setAuthError('Date of birth cannot be in the future')
      return
    }

    if (calculateAge(dob) < 21) {
      setAuthError('You must be 21 years or older to create a SIPGO account')
      return
    }

    if (cleanPan.length !== 10) {
      setAuthError('Enter a valid 10-character PAN')
      return
    }

    if (cleanMobile.length !== 10) {
      setAuthError('Enter a valid 10-digit mobile number')
      return
    }

    if (!email.includes('@')) {
      setAuthError('Enter a valid email address')
      return
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match')
      return
    }

    setAuthLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          name: name.trim(),
          dob,
          mobile: `+91${cleanMobile}`,
          pan: cleanPan
        }
      }
    })

    setAuthLoading(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    if (data.session) {
      setIsLoggedIn(true)
      setSession(data.session)
      return
    }

    setAuthMessage('Account created. Please verify your email, then login.')
    setAuthMode('login')
    setPassword('')
    setConfirmPassword('')
  }

  const handleLogin = async () => {
    setAuthError('')
    setAuthMessage('')

    if (!email.includes('@')) {
      setAuthError('Enter a valid email address')
      return
    }

    if (!password) {
      setAuthError('Enter your password')
      return
    }

    setAuthLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

    setAuthLoading(false)

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setAuthError('Please verify your email before login')
      } else {
        setAuthError(error.message)
      }
      return
    }

    setSession(data.session)
    setIsLoggedIn(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setIsLoggedIn(false)
    setPassword('')
  }

  const [shops, setShops] = useState([])

  const [distanceKm, setDistanceKm] = useState(0)
  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }


  const [customerLocation, setCustomerLocation] = useState(null)
  const [deliveryLocation, setDeliveryLocation] = useState(null)
  const [deliveryLocationConfirmed, setDeliveryLocationConfirmed] = useState(false)
  const [gpsDebug, setGpsDebug] = useState('')
  const [locationMessage, setLocationMessage] = useState('Getting your location...')
  const [currentPlaceName, setCurrentPlaceName] = useState('Detecting location...')

  const reverseGeocodeLocation = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      )

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`)
      }

      const data = await response.json()

      const place =
        data.locality ||
        data.city ||
        data.principalSubdivision ||
        'Current location'

      setCurrentPlaceName(place)
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      setCurrentPlaceName('Current location')
    }
  }

  useEffect(() => {
    getCustomerLocation()
  }, [])

  const getCustomerLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported on this device.')
      return
    }

    setLocationMessage('Getting your location...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setCustomerLocation({ latitude, longitude })
        setLocationMessage('Location detected ✅')
        reverseGeocodeLocation(latitude, longitude)
      },
      (error) => {
        console.error('Customer location error:', error)
        setLocationMessage('Please allow location access to see nearby shops.')
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    )
  }

  useEffect(() => {
    const loadApprovedShops = async () => {
      if (!deliveryLocation || !deliveryLocationConfirmed) {
        setShops([])
        return
      }

      const shopSearchLocation = deliveryLocation

      const { data, error } = await supabase
        .from('sipgo_shops')
        .select('*')
        .eq('verification_status', 'APPROVED')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load SIPGO shops:', error)
        setShops([])
        return
      }

      const mappedShops = await Promise.all(
        (data || []).map(async (shop) => {
          const shopLatitude = Number(shop.latitude)
          const shopLongitude = Number(shop.longitude)

          if (!Number.isFinite(shopLatitude) || !Number.isFinite(shopLongitude)) {
            console.warn('Shop has no valid GPS coordinates:', shop.id)
            return null
          }

          const shopDistanceKm = calculateDistanceKm(
            Number(shopSearchLocation.latitude),
            Number(shopSearchLocation.longitude),
            shopLatitude,
            shopLongitude
          )

          // STRICT SERVICE AREA: 6.000 km maximum.
          // Anything even 1 metre beyond 6 km is not serviceable.
          if (!Number.isFinite(shopDistanceKm) || shopDistanceKm > 6.000) {
            return null
          }

          const { data: products, error: productsError } = await supabase
            .from('sipgo_products')
            .select('*')
            .eq('shop_id', shop.id)
            .eq('active', true)
            .gt('stock', 0)
            .order('name', { ascending: true })

          if (productsError) {
            console.error('Failed to load products for shop:', shop.id, productsError)
          }

          return {
            id: shop.id,
            name: shop.shop_name,
            location: shop.location,
            openingTime: shop.opening_time,
            closingTime: shop.closing_time,
            isOpen: shop.is_open ?? true,
            time: '20–30 min',
            distanceKm: Number(shopDistanceKm.toFixed(2)),
            photo: shop.shop_photo_url || '',
            products: (products || []).map((product) => ({
              id: product.id,
              name: product.name,
              category: product.category || '',
              size: product.size || '',
              price: Number(product.price || 0),
              stock: Number(product.stock || 0),
              icon: '🍾'
            }))
          }
        })
      )

      setShops(mappedShops.filter(Boolean))
    }

    loadApprovedShops()

    const channel = supabase
      .channel('sipgo-shop-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sipgo_shops'
        },
        (payload) => {
          const updatedShop = payload.new

          setShops((current) =>
            current.map((shop) =>
              shop.id === updatedShop.id
                ? {
                    ...shop,
                    isOpen: updatedShop.is_open ?? true,
                    openingTime: updatedShop.opening_time,
                    closingTime: updatedShop.closing_time
                  }
                : shop
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [deliveryLocation, deliveryLocationConfirmed])

  const [selectedShop, setSelectedShop] = useState(null)
  const [cart, setCart] = useState([])
  const [cartShopId, setCartShopId] = useState(null)
  const getQuantity = (productId) => {
    return cart.filter((item) => item.id === productId).length
  }

  const addToCart = (product) => {
    const currentShopId = selectedShop?.id ?? product?.shop_id ?? null

    if (
      cartShopId !== null &&
      currentShopId !== null &&
      cartShopId !== currentShopId
    ) {
      setCart([product])
      setCartShopId(currentShopId)
      return
    }

    setCart((currentCart) => [...currentCart, product])

    if (currentShopId !== null) {
      setCartShopId(currentShopId)
    }
  }

  const removeFromCart = (productId) => {
    const index = cart.findIndex((item) => item.id === productId)

    if (index === -1) return

    setCart((currentCart) =>
      currentCart.filter((_, itemIndex) => itemIndex !== index)
    )

    if (cart.length === 1) {
      setCartShopId(null)
    }
  }

  const [search, setSearch] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [houseNumber, setHouseNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [showAddShop, setShowAddShop] = useState(false)

  const [savedLocations, setSavedLocations] = useState([])
  const [selectedSavedLocation, setSelectedSavedLocation] = useState(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationLabel, setLocationLabel] = useState('Home')
  const [locationSearch, setLocationSearch] = useState('')
  const [mapLocation, setMapLocation] = useState(null)
  const [locationConfirmRequired, setLocationConfirmRequired] = useState(true)

  const loadSavedLocations = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('sipgo_saved_locations')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load saved locations:', error)
      return
    }

    setSavedLocations(data || [])
  }

  useEffect(() => {
    loadSavedLocations()
  }, [])

  const saveDeliveryLocation = async (label, address, latitude, longitude) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setFormError('Please login again.')
      return false
    }

    if (!address.trim() || latitude == null || longitude == null) {
      setFormError('Please select a valid delivery location.')
      return false
    }

    const { data, error } = await supabase
      .from('sipgo_saved_locations')
      .insert({
        customer_id: user.id,
        label,
        address: address.trim(),
        latitude,
        longitude
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save delivery location:', error)
      setFormError(error.message)
      return false
    }

    setSavedLocations((current) => [data, ...current])
    setSelectedSavedLocation(data)
    setDeliveryAddress(data.address)
    setDeliveryLocation({
      latitude: data.latitude,
      longitude: data.longitude
    })
    setLocationConfirmRequired(false)
    setDeliveryLocationConfirmed(true)
    return true
  }
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showOrders, setShowOrders] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  const [shopName, setShopName] = useState('')
  const [shopLocation, setShopLocation] = useState('Doddaballapur')
  const [shopTime, setShopTime] = useState('20–30 min')
  const [shopPhoto, setShopPhoto] = useState('')
  const [formError, setFormError] = useState('')


  const handlePlaceOrder = async () => {
    setFormError('')

    if (!customerName.trim()) {
      setFormError('Please enter your full name.')
      return
    }

    if (customerPhone.replace(/\D/g, '').length !== 10) {
      setFormError('Please enter a valid 10-digit phone number.')
      return
    }

    if (!deliveryAddress.trim()) {
      setFormError('Please select your delivery address.')
      return
    }

    if (!deliveryLocation) {
      setFormError('Please select a delivery location.')
      return
    }

    if (locationConfirmRequired || !deliveryLocationConfirmed) {
      setFormError('Please confirm your delivery location.')
      return
    }

    if (!houseNumber.trim()) {
      setFormError('Please enter your house / flat number.')
      return
    }

    if (paymentMethod !== 'UPI') {
      setFormError('Only UPI payment is available.')
      return
    }

    if (cart.length === 0) {
      setFormError('Your cart is empty.')
      return
    }

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      setFormError('Please login again.')
      return
    }

    if (!window.Razorpay) {
      setFormError('Razorpay checkout is not loaded. Please refresh and try again.')
      return
    }

    const grouped = Object.values(
      cart.reduce((acc, item) => {
        if (!acc[item.id]) {
          acc[item.id] = { ...item, quantity: 0 }
        }
        acc[item.id].quantity += 1
        return acc
      }, {})
    )

    const subtotal = grouped.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    const actualDistanceKm = Number(selectedShop?.distanceKm || distanceKm || 0)

    let deliveryFee = 0
    if (actualDistanceKm <= 2) {
      deliveryFee = 30
    } else if (actualDistanceKm <= 3) {
      deliveryFee = 50
    } else if (actualDistanceKm <= 6) {
      deliveryFee = 70
    } else {
      setFormError('This shop is outside the 6 km delivery area.')
      return
    }

    const serviceCharge = Math.round(subtotal * 0.05)
    const handlingCharge = 26
    const total = subtotal + deliveryFee + serviceCharge + handlingCharge
    const amountInPaise = Math.round(total * 100)

    setFormError('Opening secure Razorpay payment...')

    const receipt = `sipgo_${user.id.slice(0, 8)}_${Date.now()}`

    const { data: razorpayOrder, error: razorpayOrderError } =
      await supabase.functions.invoke('create-razorpay-order', {
        body: {
          amount: amountInPaise,
          receipt
        }
      })

    if (razorpayOrderError || !razorpayOrder?.id) {
      console.error('Razorpay order creation failed:', razorpayOrderError, razorpayOrder)
      setFormError('Unable to start payment. Please try again.')
      return
    }

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency || 'INR',
      name: 'SIPGO',
      description: 'SIPGO Order Payment',
      order_id: razorpayOrder.id,
      prefill: {
        name: customerName.trim(),
        contact: customerPhone.replace(/\D/g, '')
      },
      theme: {
        color: '#ff5a1f'
      },
      handler: async (response) => {
        setFormError('Verifying payment...')

        const { data: verification, error: verificationError } =
          await supabase.functions.invoke('verify-razorpay-payment', {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              expected_amount: amountInPaise
            }
          })

        if (
          verificationError ||
          !verification?.verified
        ) {
          console.error('Razorpay verification failed:', verificationError, verification)
          setFormError('Payment verification failed. Your order was not created.')
          return
        }

        const { error } = await supabase
          .from('sipgo_orders')
          .insert({
            customer_id: user.id,
            shop_id: selectedShop?.id || null,
            status: 'PENDING',
            payment_status: 'PAID',
            payment_method: 'UPI',
            customer_name: customerName.trim(),
            customer_phone: customerPhone.replace(/\D/g, ''),
            delivery_address: `${houseNumber.trim()}, ${deliveryAddress.trim()}`,
            delivery_latitude: deliveryLocation?.latitude ?? null,
            delivery_longitude: deliveryLocation?.longitude ?? null,
            items: grouped,
            subtotal,
            delivery_fee: deliveryFee,
            total_amount: total,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          })

        if (error) {
          console.error('Order creation failed after verified payment:', error)
          setFormError('Payment succeeded, but order creation failed. Please contact SIPGO support.')
          return
        }

        setFormError('')
        setCart([])
        setCartShopId(null)
        setShowCheckout(false)
      },
      modal: {
        ondismiss: () => {
          setFormError('Payment cancelled. No order was created.')
        }
      }
    }

    const razorpay = new window.Razorpay(options)

    razorpay.on('payment.failed', (response) => {
      console.error('Razorpay payment failed:', response?.error)
      setFormError('Payment failed. No order was created.')
    })

    razorpay.open()
  }

  if (showCheckout) {
    const grouped = Object.values(
      cart.reduce((acc, item) => {
        if (!acc[item.id]) {
          acc[item.id] = { ...item, quantity: 0 }
        }
        acc[item.id].quantity += 1
        return acc
      }, {})
    )

    const subtotal = grouped.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    const actualDistanceKm = Number(selectedShop?.distanceKm || distanceKm || 0)

    let deliveryFee = 0
    if (actualDistanceKm <= 2) {
      deliveryFee = 30
    } else if (actualDistanceKm <= 3) {
      deliveryFee = 50
    } else if (actualDistanceKm <= 6) {
      deliveryFee = 70
    }

    const serviceCharge = Math.round(subtotal * 0.05)
    const handlingCharge = 26
    const total = subtotal + deliveryFee + serviceCharge + handlingCharge

    return (
      <div className="app">
        <header className="topbar">
          <button
            className="back"
            onClick={() => {
              setShowCheckout(false)
              setShowCart(true)
            }}
          >
            ←
          </button>

          <div>
            <div className="brand">SIP<span>GO</span></div>
            <div className="location">💳 Checkout</div>
          </div>

          <div className="headerSpace" />
        </header>

        <main>
          <h1 className="cartHeading">Checkout</h1>

          <section className="checkoutCard">
            <h2>Delivery details</h2>

            <input
              className="checkoutInput"
              type="text"
              placeholder="Full name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />

            <input
              className="checkoutInput"
              type="tel"
              placeholder="Phone number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            
            <input
              className="checkoutInput"
              type="text"
              placeholder="House / Flat / Door number"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
            />

            {showLocationPicker && (
              <div className="locationPickerCard">
                <h3>Select delivery location</h3>

                <DeliveryMapPicker
                  initialLocation={customerLocation}
                  onSelect={(location) => {
                    setMapLocation(location)
                    setDeliveryAddress(location.address)
                    setDeliveryLocation({
                      latitude: location.latitude,
                      longitude: location.longitude
                    })
                    setSelectedSavedLocation({
                      id: null,
                      label: 'Other',
                      address: location.address,
                      latitude: location.latitude,
                      longitude: location.longitude
                    })
                    setLocationConfirmRequired(true)
                    setDeliveryLocationConfirmed(false)
                  }}
                />

                {mapLocation && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#f5f5f5'
                  }}>
                    <strong>📍 Selected location</strong>
                    <div>{mapLocation.address}</div>
                    <small>
                      {mapLocation.latitude.toFixed(6)}, {mapLocation.longitude.toFixed(6)}
                    </small>
                  </div>
                )}

                {savedLocations.length > 0 && (
                  <div className="savedLocationsList">
                    <strong>Saved locations</strong>

                    {savedLocations.map((location) => (
                      <button
                        type="button"
                        key={location.id}
                        className="savedLocationItem"
                        onClick={() => {
                          setSelectedSavedLocation(location)
                          setDeliveryAddress(location.address)
                          setDeliveryLocation({
                            latitude: location.latitude,
                            longitude: location.longitude
                          })
                          setLocationConfirmRequired(false)
                          setDeliveryLocationConfirmed(true)
                          setShowLocationPicker(false)
                        }}
                      >
                        <b>
                          {location.label === 'Home'
                            ? '🏠'
                            : location.label === 'Office'
                              ? '🏢'
                              : '📍'}{' '}
                          {location.label}
                        </b>
                        <span>{location.address}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="saveLocationSection">
                  <strong>Save current delivery location as</strong>

                  <div className="locationLabelButtons">
                    {['Home', 'Office', 'Other'].map((label) => (
                      <button
                        type="button"
                        key={label}
                        className={
                          locationLabel === label
                            ? 'locationLabelButton active'
                            : 'locationLabelButton'
                        }
                        onClick={() => setLocationLabel(label)}
                      >
                        {label === 'Home'
                          ? '🏠 Home'
                          : label === 'Office'
                            ? '🏢 Office'
                            : '📍 Other'}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="saveLocationButton"
                    onClick={async () => {
                      const selectedLocation = mapLocation || deliveryLocation

                      if (!selectedLocation) {
                        setFormError('Please select a location on the map.')
                        return
                      }

                      const saved = await saveDeliveryLocation(
                        locationLabel,
                        mapLocation?.address || deliveryAddress,
                        selectedLocation.latitude,
                        selectedLocation.longitude
                      )

                      if (saved) {
                        setLocationSearch('')
                        setShowLocationPicker(false)
                        setLocationConfirmRequired(false)
                        setDeliveryLocationConfirmed(true)
                      }
                    }}
                  >
                    Save this location
                  </button>
                </div>

                <button
                  type="button"
                  className="locationCloseButton"
                  onClick={() => setShowLocationPicker(false)}
                >
                  Close
                </button>
              </div>
            )}
          </section>

          <section className="checkoutCard">
            <h2>Payment method</h2>

            <label className="paymentOption">
              <input
                type="radio"
                value="UPI"
                checked={paymentMethod === 'UPI'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>UPI</span>
            </label>

            <label className="paymentOption" style={{ opacity: 0.55 }}>
              <input
                type="radio"
                value="Cash"
                checked={false}
                disabled
              />
              <span>Cash on Delivery — Not available</span>
            </label>
          </section>

          <section className="billCard">
            <div>
              <span>Subtotal</span>
              <strong>₹{subtotal}</strong>
            </div>

            <div>
              <span>
                Delivery ({selectedShop?.distanceKm != null
                  ? selectedShop.distanceKm
                  : distanceKm} km)
              </span>
              <strong>₹{deliveryFee}</strong>
            </div>

            <div>
              <span>Handling charge</span>
              <strong>₹26</strong>
            </div>

            <div>
              <span>SIPGO service charge (5%)</span>
              <strong>₹{serviceCharge}</strong>
            </div>

            <hr />

            <div className="grandTotal">
              <span>Total</span>
              <strong>₹{total}</strong>
            </div>
          </section>

          <button className="checkoutButton" onClick={handlePlaceOrder} disabled={authLoading}>
            {authLoading ? "Placing Order..." : "Place Order →"}
          </button>

          <p className="checkoutNote">
            Age and applicable liquor-delivery requirements will be verified
            before order fulfillment.
          </p>
        </main>
      </div>
    )
  }

  if (showCart) {
    const grouped = Object.values(
      cart.reduce((acc, item) => {
        if (!acc[item.id]) {
          acc[item.id] = { ...item, quantity: 0 }
        }
        acc[item.id].quantity += 1
        return acc
      }, {})
    )

    const subtotal = grouped.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    const actualDistanceKm = Number(selectedShop?.distanceKm || distanceKm || 0)

    let deliveryFee = 0
    if (actualDistanceKm <= 2) {
      deliveryFee = 30
    } else if (actualDistanceKm <= 3) {
      deliveryFee = 50
    } else if (actualDistanceKm <= 6) {
      deliveryFee = 70
    }

    const serviceCharge = Math.round(subtotal * 0.05)
    const handlingCharge = 26
    const total = subtotal + deliveryFee + serviceCharge + handlingCharge

    return (
      <div className="app">
        <header className="topbar">
          <button className="back" onClick={() => setShowCart(false)}>←</button>
          <div>
            <div className="brand">SIP<span>GO</span></div>
            <div className="location">🛒 Your Cart</div>
          </div>
          <div className="headerSpace" />
        </header>

        <main>
          <h1 className="cartHeading">Your Cart</h1>

          {grouped.length === 0 ? (
            <div className="emptyCart">
              <div>🛒</div>
              <h2>Your cart is empty</h2>
              <p>Add liquor from a shop to continue.</p>
            </div>
          ) : (
            <>
              <div className="cartItems">
                {grouped.map((item) => (
                  <div className="cartItem" key={item.id}>
                    <div className="cartItemIcon">{item.icon}</div>

                    <div className="cartItemInfo">
                      <h3>{item.name}</h3>
                      <p>{item.size}</p>
                      <strong>₹{item.price} × {item.quantity}</strong>
                    </div>

                    <div className="cartItemTotal">
                      ₹{item.price * item.quantity}
                    </div>
                  </div>
                ))}
              </div>

              <div className="distanceCard">
                <div>
                  <strong>Delivery distance</strong>
                  <span>
                    {selectedShop?.distanceKm != null
                      ? `${selectedShop.distanceKm} km`
                      : 'Calculating...'}
                  </span>
                </div>
                <small>📍 Distance calculated automatically from your location</small>
              </div>

              <div className="billCard">
                <div>
                  <span>Subtotal</span>
                  <strong>₹{subtotal}</strong>
                </div>

                <div>
                  <span>Delivery ({distanceKm} km)</span>
                  <strong>₹{deliveryFee}</strong>
                </div>

                <div>
                  <span>SIPGO service charge (5%)</span>
                  <strong>₹{serviceCharge}</strong>
                </div>

                <hr />

                <div className="grandTotal">
                  <span>Total</span>
                  <strong>₹{total}</strong>
                </div>
              </div>

              <button
                className="checkoutButton"
                disabled={
                  !isShopOpen(
                    selectedShop?.openingTime,
                    selectedShop?.closingTime
                  )
                }
                onClick={() => {
                  if (
                    !isShopOpen(
                      selectedShop?.openingTime,
                      selectedShop?.closingTime
                    )
                  ) {
                    return
                  }

                  setShowCart(false)
                  setShowCheckout(true)
                }}
              >
                {isShopOpen(
                  selectedShop?.openingTime,
                  selectedShop?.closingTime
                )
                  ? 'Proceed to Checkout →'
                  : '🔴 Shop Closed'}
              </button>
            </>
          )}
        </main>
      </div>
    )
  }

  if (
    !selectedShop &&
    !showProfile &&
    !showOrders &&
    !showCart &&
    !showCheckout &&
    !deliveryLocationConfirmed
  ) {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <div className="brand">SIP<span>GO</span></div>
            <div className="location">📍 Select delivery location</div>
          </div>
        </header>

        <main>
          <section className="welcome">
            <p>Licensed liquor delivery</p>
            <h1>Where should we<br />deliver?</h1>
            <p style={{ marginTop: '8px' }}>
              Select your delivery location first. We will show only approved SIPGO stores within 6 km.
            </p>
          </section>

          <DeliveryMapPicker
            initialLocation={customerLocation}
            onSelect={(location) => {
              setMapLocation(location)
              setDeliveryAddress(location.address)
              setDeliveryLocation({
                latitude: location.latitude,
                longitude: location.longitude
              })
              setSelectedSavedLocation({
                id: null,
                label: 'Other',
                address: location.address,
                latitude: location.latitude,
                longitude: location.longitude
              })
              setLocationConfirmRequired(true)
              setDeliveryLocationConfirmed(false)
            }}
          />

          {savedLocations.length > 0 && (
            <div className="savedLocationsList" style={{ marginTop: '14px' }}>
              <strong>Saved locations</strong>

              {savedLocations.map((location) => (
                <button
                  type="button"
                  key={location.id}
                  className="savedLocationItem"
                  onClick={() => {
                    setSelectedSavedLocation(location)
                    setMapLocation(location)
                    setDeliveryAddress(location.address)
                    setDeliveryLocation({
                      latitude: location.latitude,
                      longitude: location.longitude
                    })
                    setLocationConfirmRequired(false)
                    setDeliveryLocationConfirmed(true)
                    setSelectedShop(null)
                    setCart([])
                    setCartShopId(null)
                  }}
                >
                  <b>
                    {location.label === 'Home'
                      ? '🏠'
                      : location.label === 'Office'
                        ? '🏢'
                        : '📍'}{' '}
                    {location.label}
                  </b>
                  <span>{location.address}</span>
                </button>
              ))}
            </div>
          )}

          {mapLocation && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '12px',
              background: '#f5f5f5'
            }}>
              <strong>📍 Selected location</strong>
              <div>{mapLocation.address}</div>
              <small>
                {mapLocation.latitude.toFixed(6)}, {mapLocation.longitude.toFixed(6)}
              </small>
            </div>
          )}

          {mapLocation && (
            <button
              type="button"
              className="primaryButton"
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => {
                setDeliveryLocationConfirmed(true)
                setLocationConfirmRequired(false)
                setSelectedShop(null)
                setCart([])
                setCartShopId(null)
              }}
            >
              ✅ Confirm location & continue
            </button>
          )}

          <div className="saveLocationSection" style={{ marginTop: '16px' }}>
            <strong>Save selected location as</strong>

            <div className="locationLabelButtons">
              {['Home', 'Office', 'Other'].map((label) => (
                <button
                  type="button"
                  key={label}
                  className={
                    locationLabel === label
                      ? 'locationLabelButton active'
                      : 'locationLabelButton'
                  }
                  onClick={() => setLocationLabel(label)}
                >
                  {label === 'Home'
                    ? '🏠 Home'
                    : label === 'Office'
                      ? '🏢 Office'
                      : '📍 Other'}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="saveLocationButton"
              style={{ width: '100%', marginTop: '10px' }}
              onClick={async () => {
                if (!mapLocation) {
                  setFormError('Select a location on the map first.')
                  return
                }

                const saved = await saveDeliveryLocation(
                  locationLabel,
                  mapLocation.address,
                  mapLocation.latitude,
                  mapLocation.longitude
                )

                if (saved) {
                  setDeliveryLocationConfirmed(true)
                  setLocationConfirmRequired(false)
                }
              }}
            >
              💾 Save & continue
            </button>
          </div>

          {formError && (
            <div className="formError" style={{ marginTop: '12px' }}>
              {formError}
            </div>
          )}
        </main>
      </div>
    )
  }

  if (selectedShop) {
    const shopSearch = search.toLowerCase().trim()

    const shopProducts = Array.isArray(selectedShop.products)
      ? selectedShop.products
      : []

    const filteredProducts = shopProducts.filter((product) =>
      String(product?.name || '').toLowerCase().includes(shopSearch) ||
      String(product?.size || '').toLowerCase().includes(shopSearch)
    )

    return (
      <div className="app">
        <header className="topbar">
          <button className="back" onClick={() => setSelectedShop(null)}>←</button>
          <div>
            <div className="brand">SIP<span>GO</span></div>
            <div className="location">📍 {selectedShop.location}</div>
          </div>
          <button className="cart" onClick={() => setShowCart(true)}>
  🛒 {cart.length}
</button>
        </header>

        <main>
          {selectedShop.photo && (
            <img
              className="shopDetailPhoto"
              src={selectedShop.photo}
              alt={selectedShop.name}
            />
          )}

          <div className="shopHeader">
            <div>
              <h1>{selectedShop.name}</h1>
              <p>
                {isShopOpen(selectedShop.openingTime, selectedShop.closingTime)
                  ? '🟢 OPEN'
                  : '🔴 CLOSED'}
              </p>
              <p>
                🕐 {selectedShop.openingTime || '--:--'} – {selectedShop.closingTime || '--:--'}
              </p>
              <p>⚡ Delivery in {selectedShop.time}</p>
              <small>Shop information</small>
            </div>
          </div>

          <div className="shopProductSearch">
            🔎
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in this shop..."
            />
            {search && (
              <button onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          <h2 className="productTitle">Liquor available</h2>

          {shopProducts.length === 0 ? (
            <div className="emptyProducts">
              Products will appear here when the shop adds its liquor list.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="emptyProducts">
              No matching liquor found in this shop.
            </div>
          ) : (
            <div className="products">
              {filteredProducts.map((product) => (
                <div className="product" key={product.id}>
                  <div className="productIcon">{product.icon}</div>
                  <div className="productInfo">
                    <h3>{product.name}</h3>
                    <p>{product.size}</p>
                    <strong>₹{product.price}</strong>
                  </div>
                  {getQuantity(product.id) === 0 ? (
                    <button
                      className="addButton"
                      onClick={() => addToCart(product)}
                    >
                      + Add
                    </button>
                  ) : (
                    <div className="quantityControl">
                      <button
                        onClick={() => removeFromCart(product.id)}
                      >
                        −
                      </button>

                      <strong>{getQuantity(product.id)}</strong>

                      <button
                        onClick={() => addToCart(product)}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {cart.length > 0 && (
          <div className="cartBar">
            <span>{cart.length} item{cart.length > 1 ? 's' : ''} added</span>
            <button onClick={() => setShowCart(true)}>View Cart →</button>
          </div>
        )}
      </div>
    )
  }


  if (!isLoggedIn) {
    return (
      <div className="app">
        <main>
          <section className="welcome">
            <div className="brand">SIP<span>GO</span></div>

            {authMode === 'login' ? (
              <>
                <h1>Login to SIPGO</h1>
                <p>Email ID + Password</p>

                <input
                  className="formInput"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email ID"
                  autoComplete="email"
                />

                <input
                  className="formInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />

                {authError && <div className="formError">{authError}</div>}
                {authMessage && <div className="formMessage">{authMessage}</div>}

                <button
                  className="primaryButton"
                  onClick={handleLogin}
                  disabled={authLoading}
                >
                  {authLoading ? 'Logging in...' : 'Login'}
                </button>

                <button
                  className="secondaryButton"
                  onClick={() => {
                    setAuthMode('signup')
                    setAuthError('')
                    setAuthMessage('')
                  }}
                >
                  Create New Account
                </button>
              </>
            ) : (
              <>
                <h1>Create SIPGO Account</h1>
                <p>21+ only • PAN verification required</p>

                <input
                  className="formInput"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  autoComplete="name"
                />

                <label className="formLabel">Date of Birth</label>
                <input
                  className="formInput"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />

                <input
                  className="formInput"
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="PAN Number"
                  maxLength={10}
                  autoCapitalize="characters"
                />

                <input
                  className="formInput"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit Mobile Number"
                  maxLength={10}
                  autoComplete="tel"
                />

                <input
                  className="formInput"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email ID"
                  autoComplete="email"
                />

                <input
                  className="formInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="new-password"
                />

                <input
                  className="formInput"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  autoComplete="new-password"
                />

                {authError && <div className="formError">{authError}</div>}
                {authMessage && <div className="formMessage">{authMessage}</div>}

                <button
                  className="primaryButton"
                  onClick={handleSignup}
                  disabled={authLoading}
                >
                  {authLoading ? 'Creating Account...' : 'Create Account'}
                </button>

                <button
                  className="secondaryButton"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthError('')
                    setAuthMessage('')
                  }}
                >
                  Already have an account? Login
                </button>
              </>
            )}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">SIP<span>GO</span></div>
          <div className="location">📍 {currentPlaceName}</div>
        </div>
        <div className="profileSpacer"></div>
      </header>

      {showProfile && (
        <main>
          <section className="welcome">
            <div className="sectionTitle">
              <button
                className="backButton"
                onClick={() => setShowProfile(false)}
              >
                ←
              </button>
              <h2>My Profile</h2>
            </div>

            <div className="profileCard">
              <div className="profileAvatar">👤</div>
              <h3>{session?.user?.user_metadata?.name || 'SIPGO Customer'}</h3>

              <div className="profileDetails">
                <p><strong>📧 Email</strong><br />{session?.user?.email || '-'}</p>
                <p><strong>📱 Mobile</strong><br />{session?.user?.user_metadata?.mobile || '-'}</p>
                <p><strong>🎂 Date of Birth</strong><br />{session?.user?.user_metadata?.dob || '-'}</p>
                <p><strong>🔞 Age Status</strong><br />21+ Verified</p>
                <p><strong>🪪 PAN Status</strong><br />Verification Required</p>
              </div>

              <button className="primaryButton" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          </section>
        </main>
      )}

      {showOrders ? (
        <main>
          <section className="welcome">
            <div className="sectionTitle">
              <button
                className="backButton"
                onClick={() => setShowOrders(false)}
              >
                ←
              </button>
              <h2>My Orders</h2>
            </div>

            {ordersLoading ? (
              <div className="emptyState">Loading your orders...</div>
            ) : orders.length === 0 ? (
              <div className="emptyState">
                <div style={{ fontSize: '42px' }}>📦</div>
                <h3>No orders yet</h3>
                <p>Your placed orders will appear here.</p>
              </div>
            ) : (
              <div className="ordersList">
                {orders.map((order) => (
                  <div className="orderCard" key={order.id}>
                    <div className="orderCardTop">
                      <strong>Order #{order.id.slice(0, 8)}</strong>
                      <span className="orderStatus">{order.status}</span>
                    </div>

                    <div className="orderInfo">
                      <div>📍 {order.delivery_address}</div>
                      <div>💳 {order.payment_method}</div>
                      <div>💰 ₹{Number(order.total_amount).toFixed(2)}</div>
                    </div>

                    <div className="orderDate">
                      {new Date(order.created_at).toLocaleString()}
                    </div>

                    {['PENDING', 'CONFIRMED', 'ACCEPTED'].includes(order.status) && (
                      <button
                        type="button"
                        className="submitButton"
                        onClick={() => cancelOrder(order)}
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      ) : !showProfile ? (
        <main>
          <section className="welcome">
          <p>Licensed liquor delivery</p>
          <h1>Choose your<br />liquor store</h1>
        </section>

        <div className="searchBox">
          🔎
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search liquor shops or liquor..."
          />
        </div>

        <div className="sectionTitle">
          <h2>Liquor Shops</h2>
          <span>
            {shops.length === 0
              ? 'No service available in this area'
              : `${shops.length} store${shops.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="shopList">
          {shops
            .filter((shop) => {
              const q = search.toLowerCase().trim()
              if (!q) return true

              return (
                shop.name.toLowerCase().includes(q) ||
                shop.location.toLowerCase().includes(q) ||
                shop.products.some((product) =>
                  product.name.toLowerCase().includes(q)
                )
              )
            })
            .map((shop) => (
            <button
              className="shopCard"
              key={shop.id}
              onClick={() => {
                if (!isShopOpen(shop.openingTime, shop.closingTime)) {
                  return
                }
                setSelectedShop(shop)
              }}
              disabled={!isShopOpen(shop.openingTime, shop.closingTime)}
            >
              <div className="shopPhoto">
                {shop.photo ? (
                  <img src={shop.photo} alt={shop.name} />
                ) : (
                  <div className="photoPlaceholder">📷</div>
                )}
              </div>

              <div className="shopInfo">
                <h3>{shop.name}</h3>
                <p>📍 {shop.location}</p>
                <p>
                  {shop.isOpen
                    ? '🟢 OPEN'
                    : '🔴 CLOSED'}
                </p>
                <p>
                  🕐 {shop.openingTime || '--:--'} – {shop.closingTime || '--:--'}
                </p>
                <p>⚡ Delivery in {shop.time}</p>
              </div>

              <div className="shopArrow">›</div>
            </button>
          ))}
        </div>

        <div className="categoriesTitle">Browse by category</div>

        <div className="categories">
          <div>🍺<small>Beer</small></div>
          <div>🥃<small>Whisky</small></div>
          <div>🍷<small>Wine</small></div>
          <div>🥂<small>Premium</small></div>
        </div>
      </main>
      ) : null}

      <nav className="bottomNav">
        <button className="active">⌂<span>Home</span></button>
        <button>🔎<span>Search</span></button>
        <button onClick={() => setShowCart(true)}>🛒<span>Cart</span></button>
        <button
          onClick={() => {
            setShowProfile(false)
            setShowOrders(true)
            loadMyOrders()
          }}
        >
          📦<span>Orders</span>
        </button>
        <button onClick={() => setShowProfile(true)}>👤<span>Profile</span></button>
      </nav>
    </div>
  )
}

export default App
