// Shared travel cost utilities used by both VisualJourneyMap and QuickTrip

export function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface CommutePricing {
  type: 'bike' | 'cab';
  service: string;
  cost: number;
}

export function calculateCost(distanceKm: number, timeMins: number, paxCount: number): CommutePricing {
  if (paxCount === 1 && distanceKm < 5) {
    let distanceCost = 0;
    if (distanceKm > 2) distanceCost = (distanceKm - 2) * 15;
    const totalFare = 35 + distanceCost + (timeMins * 0.22);
    return { type: 'bike', service: 'Rapido Bike', cost: Math.round(totalFare) };
  } else if (paxCount <= 4) {
    let distanceCost = distanceKm <= 20 ? distanceKm * 7 : (20 * 7) + ((distanceKm - 20) * 14);
    const totalFare = 40 + distanceCost + (timeMins * 1.50);
    return { type: 'cab', service: 'Uber Go', cost: Math.round(totalFare) };
  } else if (paxCount <= 6) {
    const distanceCost = distanceKm * 12;
    const totalFare = 60 + distanceCost + (timeMins * 2.50);
    return { type: 'cab', service: 'Uber XL (SUV)', cost: Math.round(totalFare) };
  } else {
    const cabsNeeded = Math.ceil(paxCount / 4);
    const distanceCost = distanceKm <= 20 ? distanceKm * 7 : (20 * 7) + ((distanceKm - 20) * 14);
    const costPerCab = 40 + distanceCost + (timeMins * 1.50);
    return { type: 'cab', service: `${cabsNeeded}x Uber Go`, cost: Math.round(costPerCab * cabsNeeded) };
  }
}
