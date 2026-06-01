import pandas as pd
import json
import uuid
import random
from datetime import datetime

# Path to the Excel file
excel_path = 'C:/Users/prave/Desktop/tms/ASH Backup data 251225-210526.xlsx'

# Load the Excel file
xl = pd.ExcelFile(excel_path)

# Load sheets with correct header row (index 2)
df1 = pd.read_excel(xl, 'Master PRMNDPR', header=2)
df2 = pd.read_excel(xl, 'Master DRMGRH', header=2)

print("Sheet 1 shape:", df1.shape)
print("Sheet 2 shape:", df2.shape)

# 1. Extract and Clean Vehicle Numbers (Trucks)
vehicles_s1 = set(df1['Vehicle No.'].dropna().astype(str).str.strip().str.upper().unique())
vehicles_s2 = set(df2['Vehicle No.'].dropna().astype(str).str.strip().str.upper().unique())
all_vehicles = sorted(list(vehicles_s1.union(vehicles_s2)))
print(f"Found {len(all_vehicles)} unique vehicles.")

# 2. Generate 300 Drivers with Indian Names
first_names = ["Rajesh", "Sanjay", "Ramesh", "Anil", "Sunil", "Dinesh", "Suresh", "Vijay", "Manoj", "Rahul", 
               "Vikram", "Ajay", "Santosh", "Manish", "Amit", "Sandip", "Pradeep", "Satish", "Pankaj", "Deepak", 
               "Ashok", "Gurpreet", "Manpreet", "Harpreet", "Jaspreet", "Karan", "Arjun", "Karthik", "Hari", "Ravindra",
               "Balwinder", "Sukhdev", "Jagdish", "Mahendra", "Devendra", "Kiran", "Joginder", "Lalit", "Mohan", "Naveen"]
last_names = ["Kumar", "Singh", "Yadav", "Sharma", "Verma", "Patel", "Reddy", "Raja", "Nair", "Das", 
              "Joshi", "Choudhary", "Gupta", "Mishra", "Pandey", "Mehta", "Gill", "Dhillon", "Saini", "Rao",
              "Rathore", "Solanki", "Bhati", "Naik", "Swamy", "Pillai", "Patil", "Jadhav", "Shinde", "Deshmukh"]

random.seed(42)  # For deterministic generation

drivers = []
generated_names = set()
for i in range(1, 301):
    while True:
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        if name not in generated_names:
            generated_names.add(name)
            break
    
    phone = f"+919{random.randint(100000000, 999999999)}"
    license_no = f"DL-{random.randint(1000000000, 9999999999)}"
    drivers.append({
        "id": f"drv-{i}",
        "fullName": name,
        "phone": phone,
        "licenseNumber": license_no,
        "status": "AVAILABLE" if random.random() > 0.1 else "ON_TRIP",
        "verified": True
    })

print(f"Generated {len(drivers)} drivers.")

# Map trucks to drivers
truck_driver_map = {}
for idx, plate in enumerate(all_vehicles):
    # Distribute the 300 drivers among 499 trucks
    driver = drivers[idx % len(drivers)]
    truck_driver_map[plate] = driver

# 3. Create Truck objects
truck_models = ["Tata Prima 4028.S", "Ashok Leyland U-4019", "BharatBenz 4023T", "Mahindra Blazo X 49", "Volvo FMX 460"]
trucks = []
for idx, plate in enumerate(all_vehicles):
    capacity_val = 31.0 + (idx % 12) * 1.0  # Generate some capacities around 31-43 tons
    trucks.append({
        "id": f"trk-{idx + 1}",
        "plateNumber": plate,
        "model": truck_models[idx % len(truck_models)],
        "type": "Tipper",
        "capacity": f"{capacity_val:.1f} Tons",
        "fuelCard": f"CARD-OD-{10000 + idx}",
        "health": random.randint(75, 98),
        "status": "AVAILABLE" if idx % 5 != 0 else "ON_TRIP"
    })

print(f"Prepared {len(trucks)} trucks.")

# 4. Generate Purchase Orders
purchase_orders = [
    {
        "id": "po-vedanta-prmndpr",
        "poNumber": "PO-VEDANTA-PRMNDPR-01",
        "clientName": "Vedanta Limited (Lanjigarh)",
        "commodity": "Fly Ash",
        "totalQuantityTons": 500000.0,
        "allocatedQuantityTons": 0.0,
        "ratePerTon": 240.0,
        "status": "ACTIVE"
    },
    {
        "id": "po-vedanta-drmgrh",
        "poNumber": "PO-VEDANTA-DRMGRH-02",
        "clientName": "Vedanta Limited (Lanjigarh)",
        "commodity": "Fly Ash",
        "totalQuantityTons": 300000.0,
        "allocatedQuantityTons": 0.0,
        "ratePerTon": 280.0,
        "status": "ACTIVE"
    }
]

# 5. Process Trips and Weighbridge Tickets
trips = []
weigh_tickets = []

def clean_float(val):
    if pd.isna(val):
        return 0.0
    try:
        if isinstance(val, str):
            val = val.replace(',', '').strip()
        return float(val)
    except:
        return 0.0

def clean_str(val):
    if pd.isna(val):
        return ""
    return str(val).strip()

trip_counter = 1

# Process Sheet 1 (Paramanandpur)
for idx, row in df1.iterrows():
    plate = clean_str(row.get('Vehicle No.'))
    if not plate:
        continue
    
    qty = clean_float(row.get('QTY'))
    challan = clean_str(row.get('Challan'))
    ticket = clean_str(row.get('Ticket'))
    date_val = row.get('Date')
    
    # Format date
    date_str = ""
    if pd.notna(date_val):
        if isinstance(date_val, datetime):
            date_str = date_val.isoformat()
        else:
            try:
                date_str = pd.to_datetime(date_val).isoformat()
            except:
                date_str = str(date_val)
                
    driver = truck_driver_map.get(plate, drivers[0])
    truck_info = next((t for t in trucks if t["plateNumber"] == plate), trucks[0])
    
    trip_id = f"trip-prm-{trip_counter}"
    trip_no = f"TRIP-PRM-{10000 + trip_counter}"
    
    trip = {
        "id": trip_id,
        "tripNumber": trip_no,
        "source": "Vedanta Lanjigarh Plant (Mines Loading)",
        "destination": "Paramanandpur Stockyard (Unloading)",
        "distanceKm": 120,
        "estimatedQuantityTons": qty,
        "actualLoadedTons": qty,
        "actualDeliveredTons": qty,
        "status": "COMPLETED",
        "scheduledStartDate": date_str,
        "driver": {
            "fullName": driver["fullName"],
            "phone": driver["phone"]
        },
        "truck": {
            "plateNumber": plate,
            "model": truck_info["model"]
        },
        "purchaseOrder": {
            "poNumber": "PO-VEDANTA-PRMNDPR-01",
            "clientName": "Vedanta Limited (Lanjigarh)",
            "commodity": "Fly Ash"
        }
    }
    trips.append(trip)
    purchase_orders[0]["allocatedQuantityTons"] += qty
    
    if ticket:
        weigh_tickets.append({
            "id": f"tkt-prm-{trip_counter}",
            "ticketNo": f"TKT-WB-{ticket}",
            "tripNo": trip_no,
            "truckPlate": plate,
            "material": "Fly Ash",
            "grossTons": round(qty + 15.2, 2),
            "tareTons": 15.2,
            "netTons": qty,
            "sealNumber": f"SEAL-PRM-{challan}" if challan else "SEAL-PRM-NA",
            "status": "VERIFIED",
            "timestamp": date_str
        })
        
    trip_counter += 1

# Process Sheet 2 (Dharamgarh)
for idx, row in df2.iterrows():
    plate = clean_str(row.get('Vehicle No.'))
    if not plate:
        continue
    
    qty = clean_float(row.get('Received Qty'))
    challan = clean_str(row.get('Challan (Durga)'))
    if not challan:
        challan = clean_str(row.get('Challan (ESPL)'))
        
    ticket = clean_str(row.get('Ticket'))
    date_val = row.get('Date')
    
    # Format date
    date_str = ""
    if pd.notna(date_val):
        if isinstance(date_val, datetime):
            date_str = date_val.isoformat()
        else:
            try:
                date_str = pd.to_datetime(date_val).isoformat()
            except:
                date_str = str(date_val)
                
    driver = truck_driver_map.get(plate, drivers[0])
    truck_info = next((t for t in trucks if t["plateNumber"] == plate), trucks[0])
    
    trip_id = f"trip-drm-{trip_counter}"
    trip_no = f"TRIP-DRM-{20000 + trip_counter}"
    
    trip = {
        "id": trip_id,
        "tripNumber": trip_no,
        "source": "Vedanta Lanjigarh Plant (Mines Loading)",
        "destination": "Dharamgarh Terminal (Unloading)",
        "distanceKm": 150,
        "estimatedQuantityTons": qty,
        "actualLoadedTons": qty,
        "actualDeliveredTons": qty,
        "status": "COMPLETED",
        "scheduledStartDate": date_str,
        "driver": {
            "fullName": driver["fullName"],
            "phone": driver["phone"]
        },
        "truck": {
            "plateNumber": plate,
            "model": truck_info["model"]
        },
        "purchaseOrder": {
            "poNumber": "PO-VEDANTA-DRMGRH-02",
            "clientName": "Vedanta Limited (Lanjigarh)",
            "commodity": "Fly Ash"
        }
    }
    trips.append(trip)
    purchase_orders[1]["allocatedQuantityTons"] += qty
    
    if ticket:
        weigh_tickets.append({
            "id": f"tkt-drm-{trip_counter}",
            "ticketNo": f"TKT-WB-{ticket}",
            "tripNo": trip_no,
            "truckPlate": plate,
            "material": "Fly Ash",
            "grossTons": round(qty + 15.3, 2),
            "tareTons": 15.3,
            "netTons": qty,
            "sealNumber": f"SEAL-DRM-{challan}" if challan else "SEAL-DRM-NA",
            "status": "VERIFIED",
            "timestamp": date_str
        })
        
    trip_counter += 1

print(f"Processed {len(trips)} trips.")
print(f"Processed {len(weigh_tickets)} weighbridge tickets.")

# Make a few very recent trips 'EN_ROUTE' or 'SCHEDULED' to show active telemetry in dispatch page!
# Sort trips by date first so we know what is recent
def parse_trip_date(t):
    try:
        return datetime.fromisoformat(t["scheduledStartDate"])
    except:
        return datetime.min

trips.sort(key=parse_trip_date, reverse=True)

# Update some status for active telemetry demo
for i in range(min(5, len(trips))):
    trips[i]["status"] = "EN_ROUTE"
    # Find matching weigh ticket and make it pending gross
    t_no = trips[i]["tripNumber"]
    for w in weigh_tickets:
        if w["tripNo"] == t_no:
            w["status"] = "PENDING_GROSS"
            w["grossTons"] = 0.0
            w["netTons"] = 0.0

for i in range(5, min(10, len(trips))):
    trips[i]["status"] = "SCHEDULED"

# Build final output
output_data = {
    "trucks": trucks,
    "drivers": drivers,
    "purchaseOrders": purchase_orders,
    "trips": trips,
    "weighTickets": weigh_tickets
}

# Write output file
import os
output_path = 'C:/Users/prave/Desktop/tms/frontend/app/data/tms_data.json'
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, 'w') as f:
    json.dump(output_data, f, indent=2)

print("Data output written successfully to:", output_path)

