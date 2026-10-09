import type { LocationEquipment } from '@progrex/shared';
import { asc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import { locations, type Location } from '@/db/schema';
import { deleteStamps, insertStamps, newId, todayLocalDate, updateStamps } from '@/db/stamps';
import { getCurrentLocationId, getTravel, setCurrentLocationId } from '@/lib/preferences';

export async function listLocations(): Promise<Location[]> {
  return db.select().from(locations).where(isNull(locations.deletedAt)).orderBy(asc(locations.name));
}

export async function getLocation(id: string): Promise<Location | undefined> {
  return db.select().from(locations).where(eq(locations.id, id)).get();
}

/** The usual place: the last one picked "for good", else the first. */
export async function getHomeLocation(): Promise<Location | undefined> {
  const all = await listLocations();
  const currentId = await getCurrentLocationId();
  return all.find((location) => location.id === currentId) ?? all[0];
}

export type TravelState = { location: Location; until: string; home: Location | undefined };

/** The trip in progress, if any (it ends by itself after its last day). */
export async function getActiveTravel(): Promise<TravelState | null> {
  const travel = await getTravel();
  if (!travel || travel.until < todayLocalDate()) return null;
  const location = await getLocation(travel.locationId);
  if (!location || location.deletedAt) return null;
  return { location, until: travel.until, home: await getHomeLocation() };
}

/** Where the next workout happens: the trip's place while travelling, else the usual one. */
export async function getCurrentLocation(): Promise<Location | undefined> {
  const travel = await getActiveTravel();
  return travel?.location ?? (await getHomeLocation());
}

export async function createLocation(name: string, equipment: LocationEquipment): Promise<string> {
  const id = newId();
  await db.insert(locations).values({ id, name, equipment, ...insertStamps() });
  // A brand new place is probably where the user is about to train.
  await setCurrentLocationId(id);
  notifyChanged('locations');
  return id;
}

export async function updateLocation(id: string, name: string, equipment: LocationEquipment): Promise<void> {
  await db
    .update(locations)
    .set({ name, equipment, ...updateStamps() })
    .where(eq(locations.id, id));
  notifyChanged('locations');
}

export async function deleteLocation(id: string): Promise<void> {
  await db.update(locations).set(deleteStamps()).where(eq(locations.id, id));
  notifyChanged('locations');
}
