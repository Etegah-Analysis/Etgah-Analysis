self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'رسالة جديدة - منصة اتجاه';
  const options = {
    body: data.body || 'وصلتك رسالة جديدة في الواتساب',
    icon: '/logo.jpg',
    badge: '/logo.jpg',
    vibrate: [200, 100, 200],
    data: { url: '/inbox' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/inbox');
      }
    })
  );
});
