# Planetary Agent System - Troubleshooting Guide

## 🚨 Quick Issue Resolution

This guide helps you resolve common issues with the Planetary Agent System. Start with the symptom that matches your problem.

---

## 📋 Table of Contents

1. [System Won't Load](#system-wont-load)
2. [Agents Not Appearing](#agents-not-appearing)
3. [Chat Not Working](#chat-not-working)
4. [Zodiac Wheel Issues](#zodiac-wheel-issues)
5. [Mobile Problems](#mobile-problems)
6. [Performance Issues](#performance-issues)
7. [Browser Compatibility](#browser-compatibility)
8. [Error Messages](#error-messages)
9. [Advanced Diagnostics](#advanced-diagnostics)
10. [Getting Help](#getting-help)

---

## 🔄 System Won't Load

### Symptom: Time Laboratory won't open or Planetary Agents tab is missing

#### **Immediate Actions**

1. **Refresh the page**: Press `Ctrl+R` (Windows/Linux) or `Cmd+R` (Mac)
2. **Clear browser cache**:
   - Chrome: `Ctrl+Shift+R` or Settings → Privacy → Clear browsing data
   - Firefox: `Ctrl+F5` or Settings → Privacy → Clear Recent History
   - Safari: `Cmd+Option+E` to empty cache

#### **Detailed Solutions**

##### **JavaScript Disabled**

```
Error: "JavaScript must be enabled"
```

- **Chrome**: Settings → Privacy and security → Site settings → JavaScript → Allowed
- **Firefox**: Type `about:config` → Search `javascript.enabled` → Set to `true`
- **Safari**: Preferences → Security → Enable JavaScript

##### **Network Issues**

```
Error: "Failed to load resources"
```

- Check internet connection
- Try different network (WiFi vs cellular)
- Disable VPN if active
- Check firewall settings

##### **Browser Extensions**

```
Error: "Content blocked by extension"
```

- Temporarily disable extensions one by one
- Common culprits: Ad blockers, privacy extensions, script blockers
- Try incognito/private browsing mode

---

## 👤 Agents Not Appearing

### Symptom: No agents show up in Overview mode or Zodiac wheel is empty

#### **Date-Related Issues**

##### **No Agents for Selected Date**

```
Expected: Agents visible
Actual: "No Significant Activations"
```

- **Solution**: Some dates have fewer active agents. Try:
  - Current date (most agents active)
  - Full moon or new moon dates
  - Planetary conjunction dates
  - Use date picker to find dates with more activity

##### **Future/Past Date Issues**

```
Error: "Invalid date selected"
```

- **Date Range**: System supports ±100 years from current date
- **Time Zone**: Ensure correct timezone settings
- **Daylight Saving**: Check for DST transition dates

#### **Calculation Errors**

##### **Astronomical Calculation Failure**

```
Error: "Failed to calculate planetary positions"
```

- **Browser Location Access**: Grant location permission for accurate calculations
- **System Time**: Ensure device clock is correct
- **Geographic Coordinates**: Verify latitude/longitude settings

##### **Agent Database Issues**

```
Error: "Agent configuration not found"
```

- **Page Refresh**: Hard refresh (`Ctrl+F5`)
- **Browser Cache**: Clear application cache
- **Service Worker**: Update or reset service worker

---

## 💬 Chat Not Working

### Symptom: Can't start conversations with agents

#### **Connection Issues**

##### **API Connection Failed**

```
Error: "Unable to connect to agent service"
```

- **Check Network**: Stable internet required
- **Firewall**: Ensure port 443 (HTTPS) is open
- **VPN**: Try disabling VPN
- **Corporate Network**: Some networks block AI services

##### **Rate Limiting**

```
Error: "Too many requests"
```

- **Wait Period**: 60-second cooldown between rapid requests
- **Account Limits**: Free tier: 50 messages/hour
- **Multiple Sessions**: Close other browser tabs

#### **Agent-Specific Issues**

##### **Agent Not Responding**

```
Status: Agent consciousness dormant
```

- **Activation Strength**: Agents need >50% activation
- **Time of Day**: Some agents more active during certain hours
- **Elemental Balance**: Check if elemental conditions are favorable

##### **Chat Interface Frozen**

```
Error: "Chat interface unresponsive"
```

- **Browser Memory**: Close other tabs to free memory
- **JavaScript Errors**: Check browser console (F12)
- **Session Timeout**: Refresh page to reset session

---

## 🎯 Zodiac Wheel Issues

### Symptom: Interactive wheel not working or displaying incorrectly

#### **Display Problems**

##### **Wheel Not Rendering**

```
Error: "SVG rendering failed"
```

- **WebGL Support**: Enable WebGL in browser settings
- **Graphics Drivers**: Update graphics card drivers
- **Hardware Acceleration**: Enable GPU acceleration

##### **Colors Not Showing**

```
Issue: Wheel appears monochrome
```

- **CSS Variables**: Browser must support CSS custom properties
- **Color Profile**: Check monitor color settings
- **Browser Theme**: Try default browser theme

#### **Interaction Problems**

##### **Click/Touch Not Working**

```
Issue: Can't select degrees
```

- **Touch Events**: Enable touch events in browser
- **JavaScript Events**: Ensure event listeners are active
- **Overlay Elements**: Check for interfering UI elements

##### **Zoom/Rotation Stuck**

```
Issue: Controls not responding
```

- **Gesture Support**: Enable gesture recognition
- **Touch Sensitivity**: Adjust device touch settings
- **Browser Permissions**: Grant motion/orientation permissions

---

## 📱 Mobile Problems

### Symptom: Issues specific to mobile devices

#### **Touch Gestures**

##### **Pinch to Zoom Not Working**

```
Issue: Can't zoom zodiac wheel
```

- **Gesture Support**: Enable multi-touch gestures in device settings
- **Browser Settings**: Allow zoom gestures
- **Screen Protector**: Check if interfering with touch

##### **Swipe Navigation Broken**

```
Issue: Can't rotate wheel
```

- **Touch Sensitivity**: Adjust touch sensitivity in device settings
- **Browser Zoom**: Ensure browser zoom is at 100%
- **Screen Size**: Some gestures require minimum screen size

#### **Performance Issues**

##### **Slow Loading**

```
Issue: Components take long to load
```

- **Network Speed**: Check cellular data speed
- **Memory Usage**: Close other apps
- **Battery Mode**: Exit low-power mode
- **Background Apps**: Disable battery optimization for browser

##### **Crashes/Freezes**

```
Issue: App becomes unresponsive
```

- **Memory Pressure**: Free up device memory
- **App Updates**: Update browser to latest version
- **OS Updates**: Ensure latest mobile OS
- **Restart Device**: Soft reset device

---

## ⚡ Performance Issues

### Symptom: System running slowly or consuming too many resources

#### **General Performance**

##### **High CPU Usage**

```
Issue: Browser using 100% CPU
```

- **Close Other Tabs**: Reduce memory usage
- **Disable Animations**: Set `prefers-reduced-motion: reduce`
- **Update Browser**: Latest version often more efficient
- **Hardware Acceleration**: Enable GPU acceleration

##### **Memory Leaks**

```
Issue: Memory usage keeps growing
```

- **Refresh Page**: Reset memory state
- **Close Browser**: Complete restart
- **Update Browser**: Memory leak fixes in updates
- **Disable Extensions**: Some extensions cause leaks

#### **Specific Features**

##### **Zodiac Wheel Lag**

```
Issue: Wheel animation stuttering
```

- **Reduce Quality**: Lower graphics settings
- **Disable WebGL**: Use canvas fallback
- **Reduce FPS**: Limit animation frame rate
- **Simplify Display**: Hide complex elements

##### **Chat Response Delay**

```
Issue: Agent responses slow
```

- **Network Speed**: Check connection quality
- **Server Load**: Try during off-peak hours
- **Compress Data**: Enable data compression
- **Cache Responses**: Use browser caching

---

## 🌐 Browser Compatibility

### Symptom: Issues with specific browsers

#### **Chrome Issues**

##### **WebGL Problems**

```
Error: "WebGL context lost"
```

- **Enable WebGL**: chrome://flags/#enable-webgl-draft-extensions
- **Graphics Drivers**: Update to latest drivers
- **Hardware Acceleration**: Enable in settings

##### **Extension Conflicts**

```
Issue: Extensions breaking functionality
```

- **Incognito Mode**: Test without extensions
- **Disable Gradually**: Disable extensions one by one
- **Extension Updates**: Update all extensions

#### **Firefox Issues**

##### **Canvas Rendering**

```
Error: "Canvas context failed"
```

- **Enable Canvas**: about:config → webgl.force-enabled
- **Hardware Acceleration**: Ensure enabled
- **Graphics Drivers**: Update drivers

##### **Memory Issues**

```
Issue: Out of memory errors
```

- **Increase Limit**: about:config → dom.max_script_run_time
- **Disable Multiprocess**: about:config → dom.ipc.processCount
- **Memory Settings**: Adjust Firefox memory settings

#### **Safari Issues**

##### **WebGL Support**

```
Error: "WebGL not supported"
```

- **Enable WebGL**: Develop → Experimental Features → WebGL 2.0
- **Update Safari**: Ensure latest version
- **macOS Updates**: Update operating system

##### **Touch Events**

```
Issue: Touch not working on iOS
```

- **Enable Touch**: Settings → Safari → Advanced → Experimental Features
- **iOS Updates**: Update to latest iOS
- **WebKit Features**: Enable experimental features

#### **Edge Issues**

##### **Rendering Problems**

```
Issue: Elements not displaying correctly
```

- **Enable Features**: edge://flags/#enable-experimental-web-platform-features
- **Update Edge**: Ensure latest version
- **Compatibility Mode**: Disable IE compatibility mode

---

## 🚨 Error Messages

### Common Error Codes and Solutions

#### **Network Errors**

##### **ERR_NETWORK_CHANGED**

```
Error: Network connection changed
```

- **Stable Connection**: Use wired connection if possible
- **WiFi Issues**: Restart router
- **VPN Problems**: Disable VPN temporarily
- **Firewall**: Check firewall settings

##### **ERR_INTERNET_DISCONNECTED**

```
Error: No internet connection
```

- **Offline Mode**: System has limited offline functionality
- **Network Settings**: Reset network settings
- **DNS Issues**: Try different DNS server
- **Proxy Settings**: Check proxy configuration

#### **API Errors**

##### **403 Forbidden**

```
Error: Access denied
```

- **Authentication**: Check login status
- **Permissions**: Verify account permissions
- **Rate Limits**: Wait for cooldown period
- **IP Restrictions**: Check if IP is blocked

##### **500 Internal Server Error**

```
Error: Server error
```

- **Retry**: Try again in a few minutes
- **Different Time**: Server may be under maintenance
- **Status Page**: Check service status
- **Alternative Browser**: Try different browser

#### **JavaScript Errors**

##### **TypeError: Cannot read property**

```
Error: Object property undefined
```

- **Page Refresh**: Hard refresh (Ctrl+F5)
- **Cache Clear**: Clear browser cache
- **Update Browser**: Ensure latest version
- **Disable Extensions**: Test in incognito mode

##### **ReferenceError: Function not defined**

```
Error: Required function missing
```

- **Script Loading**: Check network blocking scripts
- **Browser Security**: Allow JavaScript execution
- **Extension Interference**: Disable problematic extensions
- **Polyfill Issues**: Check browser compatibility

---

## 🔍 Advanced Diagnostics

### Developer Tools Usage

#### **Browser Console**

```
How to access: F12 → Console tab
```

- **Look for Errors**: Red error messages indicate problems
- **Network Tab**: Check failed requests
- **Application Tab**: Inspect storage and cache
- **Performance Tab**: Analyze bottlenecks

#### **Network Analysis**

```
How to access: F12 → Network tab
```

- **Failed Requests**: Look for 4xx/5xx status codes
- **Slow Responses**: Check response times >3 seconds
- **Large Files**: Identify oversized resources
- **Caching Issues**: Verify cache headers

#### **Memory Analysis**

```
How to access: F12 → Memory tab (Chrome)
```

- **Memory Leaks**: Look for growing heap size
- **Garbage Collection**: Force GC to free memory
- **Object Allocation**: Track object creation
- **Performance Impact**: Correlate with slowdowns

### System Information Gathering

#### **Browser Information**

```javascript
// Run in console to get browser info
console.log({
  userAgent: navigator.userAgent,
  language: navigator.language,
  platform: navigator.platform,
  cookieEnabled: navigator.cookieEnabled,
  onLine: navigator.onLine,
})
```

#### **Feature Support**

```javascript
// Test feature support
console.log({
  webgl: !!document.createElement('canvas').getContext('webgl'),
  touch: 'ontouchstart' in window,
  geolocation: 'geolocation' in navigator,
  localStorage: !!window.localStorage,
})
```

#### **Performance Metrics**

```javascript
// Get performance data
console.log({
  timing: performance.timing,
  navigation: performance.navigation,
  memory: performance.memory,
})
```

### Diagnostic Checklist

- [ ] Browser console shows no errors
- [ ] Network tab shows successful requests
- [ ] Memory usage is stable
- [ ] JavaScript is enabled
- [ ] Cookies are enabled
- [ ] WebGL is supported and enabled
- [ ] Touch events are working (mobile)
- [ ] Geolocation permission granted
- [ ] No conflicting browser extensions
- [ ] Latest browser version installed
- [ ] Sufficient system memory available
- [ ] Stable internet connection
- [ ] Firewall not blocking requests

---

## 🆘 Getting Help

### Support Channels

#### **Immediate Help**

- **In-App Help**: Click "?" icons for contextual help
- **Tooltips**: Hover over UI elements for explanations
- **Error Messages**: Click "Learn More" links in errors

#### **Community Support**

- **User Forums**: community.planetary-agents.com
- **Discord Server**: discord.gg/planetary-agents
- **Reddit Community**: r/PlanetaryAgents
- **GitHub Issues**: github.com/planetary-agents/issues

#### **Professional Support**

- **Email Support**: support@planetary-agents.com
- **Priority Support**: For paid subscribers
- **Live Chat**: Available during business hours
- **Phone Support**: Premium support line

### Information to Provide

When reporting issues, include:

#### **Required Information**

- **Browser & Version**: e.g., Chrome 120.0.6099.109
- **Operating System**: e.g., Windows 11, macOS 14.1, iOS 17.2
- **Device Type**: Desktop, laptop, tablet, phone
- **Error Messages**: Exact text of any errors
- **Steps to Reproduce**: Detailed reproduction steps

#### **Optional but Helpful**

- **Screenshots**: Visual representation of the issue
- **Browser Console Logs**: F12 → Console → Copy all errors
- **Network Logs**: F12 → Network → Export HAR file
- **System Specifications**: RAM, CPU, GPU information
- **Internet Speed**: Upload/download speeds
- **VPN Usage**: Whether using VPN and which provider

### Support Response Times

- **Critical Issues**: < 1 hour response
- **Major Issues**: < 4 hours response
- **Minor Issues**: < 24 hours response
- **Feature Requests**: 2-5 business days
- **General Questions**: 1-2 business days

---

## 🔄 Recovery Procedures

### Complete System Reset

#### **Browser Reset**

1. **Clear All Data**:
   - Cookies and site data
   - Cached images and files
   - Local storage and session storage

2. **Reset Browser Settings**:
   - Return to default settings
   - Re-enable required permissions
   - Update to latest version

3. **Extension Reset**:
   - Disable all extensions
   - Re-enable one by one to identify conflicts

#### **Account Reset**

1. **Clear Application Data**:
   - Log out and log back in
   - Reset user preferences
   - Clear conversation history

2. **Reinitialize Settings**:
   - Reset to default configuration
   - Reconfigure personal preferences
   - Test basic functionality

---

## 📈 Prevention Tips

### Regular Maintenance

#### **Weekly Tasks**

- [ ] Clear browser cache
- [ ] Update browser and extensions
- [ ] Check for system updates
- [ ] Verify internet connection stability

#### **Monthly Tasks**

- [ ] Run antivirus scans
- [ ] Check disk space availability
- [ ] Update graphics drivers
- [ ] Review and optimize extensions

### Best Practices

#### **Browser Usage**

- Use latest stable browser version
- Enable automatic updates
- Regularly clear browsing data
- Avoid conflicting extensions

#### **System Maintenance**

- Keep operating system updated
- Maintain sufficient free disk space
- Monitor memory usage
- Regular system restarts

#### **Network Optimization**

- Use stable internet connection
- Avoid public WiFi for sensitive operations
- Monitor network speed and latency
- Use VPN only when necessary

---

_Last updated: December 2024_

_For urgent issues requiring immediate assistance, contact support@planetary-agents.com_
