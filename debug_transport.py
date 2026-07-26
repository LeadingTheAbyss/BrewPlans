import asyncio
import sys
import traceback

sys.path.insert(0, '.')

async def main():
    try:
        from engines.ranking_engine import rank_transport
        from models.entities import Passenger
        from datetime import datetime, timedelta

        p1 = Passenger(id='1', name='T', age=25, gender='M', pincode='110001', city='Lucknow')
        d = datetime.now() + timedelta(days=10)

        for mode in ['flight', 'train', 'cab']:
            print(f"\n--- Testing mode: {mode} ---")
            try:
                result = await rank_transport('Lucknow', 'Dehradun', d, [p1], mode=mode, check_only=False)
                print(f"OK: {len(result) if result else 0} options")
            except Exception as e:
                print(f"ERROR: {e}")
                traceback.print_exc()
    except Exception as e:
        print(f"IMPORT ERROR: {e}")
        traceback.print_exc()

asyncio.run(main())
