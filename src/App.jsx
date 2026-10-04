import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

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

  const [openHour, openMinute] = openingTime.slice(0, 5).split(':').map(Number)
  const [closeHour, closeMinute] = closingTime.slice(0, 5).split(':').map(Number)

  const openMinutes = openHour * 60 + openMinute
  const closeMinutes = closeHour * 60 + closeMinute

  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes
  }

  // Supports shops that close after midnight
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes
}

function App() {
  const [shops, setShops] = useState([])

  useEffect(() => {
    const loadApprovedShops = async () => {
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

      const mappedShops = (data || []).map((shop) => ({
        id: shop.id,
        name: shop.shop_name,
        location: shop.location,
        openingTime: shop.opening_time,
        closingTime: shop.closing_time,
        time: '20–30 min',
        photo: shop.shop_photo_url || '',
        products: []
      }))

      setShops(mappedShops)
    }

    loadApprovedShops()
  }, [])

  const [selectedShop, setSelectedShop] = useState(null)
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [distanceKm, setDistanceKm] = useState(5)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [showAddShop, setShowAddShop] = useState(false)

  const [shopName, setShopName] = useState('')
  const [shopLocation, setShopLocation] = useState('Doddaballapur')
  const [shopTime, setShopTime] = useState('20–30 min')
  const [shopPhoto, setShopPhoto] = useState('')
  const [formError, setFormError] = useState('')


  const getQuantity = (productId) => {
    return cart.filter((item) => item.id === productId).length
  }

  const addToCart = (product) => {
    setCart([...cart, product])
  }

  const removeFromCart = (productId) => {
    const index = cart.findIndex((item) => item.id === productId)

    if (index !== -1) {
      const newCart = [...cart]
      newCart.splice(index, 1)
      setCart(newCart)
    }
  }

  const handlePhoto = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => setShopPhoto(reader.result)
    reader.readAsDataURL(file)
  }

  const addShop = () => {
    if (!shopName.trim()) {
      setFormError('Please enter shop name.')
      return
    }

    if (!shopPhoto) {
      setFormError('Please upload the shop photo.')
      return
    }

    setFormError('')

    const newShop = {
      id: Date.now(),
      name: shopName.trim(),
      location: shopLocation.trim() || 'Doddaballapur',
      time: shopTime,
      photo: shopPhoto,
      products: []
    }

    setShops([...shops, newShop])
    setShopName('')
    setShopLocation('Doddaballapur')
    setShopTime('20–30 min')
    setShopPhoto('')
    setShowAddShop(false)
  }

  if (showAddShop) {
    return (
      <div className="app">
        <header className="topbar">
          <button className="back" onClick={() => setShowAddShop(false)}>←</button>
          <div>
            <div className="brand">SIP<span>GO</span></div>
            <div className="location">Add liquor shop</div>
          </div>
          <div className="headerSpace" />
        </header>

        <main>
          <section className="formCard">
            <h1>Add Shop</h1>
            <p className="formHint">
              Add the shop details and its real shop photo.
            </p>

            {formError && <div className="formError">{formError}</div>}

            <label>Shop name</label>
            <input
              className="formInput"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Enter shop name"
            />

            <label>Location</label>
            <input
              className="formInput"
              value={shopLocation}
              onChange={(e) => setShopLocation(e.target.value)}
              placeholder="Enter location"
            />

            <label>Delivery time</label>
            <select
              className="formInput"
              value={shopTime}
              onChange={(e) => setShopTime(e.target.value)}
            >
              <option>15–25 min</option>
              <option>20–30 min</option>
              <option>25–35 min</option>
              <option>30–45 min</option>
            </select>

            <label>Shop photo</label>

            <label className="uploadBox">
              {shopPhoto ? (
                <img src={shopPhoto} alt="Shop preview" />
              ) : (
                <>
                  <span>📷</span>
                  <strong>Upload shop photo</strong>
                  <small>Use the actual shop photo</small>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhoto}
              />
            </label>

            <button className="primaryButton" onClick={addShop}>
              Add Shop
            </button>
          </section>
        </main>
      </div>
    )
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

    const deliveryRate = 10
    const deliveryFee = distanceKm * deliveryRate
    const serviceCharge = Math.round(subtotal * 0.05)
    const total = subtotal + deliveryFee + serviceCharge

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

            <textarea
              className="checkoutInput checkoutAddress"
              placeholder="Full delivery address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
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

            <label className="paymentOption">
              <input
                type="radio"
                value="Cash"
                checked={paymentMethod === 'Cash'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>Cash on Delivery</span>
            </label>
          </section>

          <section className="billCard">
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
          </section>

          <button className="checkoutButton">
            Place Order →
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

    const deliveryRate = 10
    const deliveryFee = distanceKm * deliveryRate
    const serviceCharge = Math.round(subtotal * 0.05)
    const total = subtotal + deliveryFee + serviceCharge

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
                  <span>{distanceKm} km</span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="20"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                />

                <small>Delivery ₹{deliveryRate}/km</small>
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

  if (selectedShop) {
    const shopSearch = search.toLowerCase().trim()

    const filteredProducts = selectedShop.products.filter((product) =>
      product.name.toLowerCase().includes(shopSearch) ||
      product.size.toLowerCase().includes(shopSearch)
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

          {selectedShop.products.length === 0 ? (
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

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="brand">SIP<span>GO</span></div>
          <div className="location">📍 Doddaballapur ▾</div>
        </div>
        <button className="profile">👤</button>
      </header>

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
          <span>{shops.length} stores</span>
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
              onClick={() => setSelectedShop(shop)}
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
                  {isShopOpen(shop.openingTime, shop.closingTime)
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

      <nav className="bottomNav">
        <button className="active">⌂<span>Home</span></button>
        <button>🔎<span>Search</span></button>
        <button onClick={() => setShowCart(true)}>🛒<span>Cart</span></button>
        <button>👤<span>Profile</span></button>
      </nav>
    </div>
  )
}

export default App
