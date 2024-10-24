from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import requests
from functools import wraps
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Database configuration using environment variables
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@"
    f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


# Define the Task model
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)


# Middleware to check for Bearer token
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token or not token.startswith('Bearer '):
            return jsonify({'message': 'Token is missing!'}), 401

        token = token.split(" ")[1]
        # Get the token validation URL from environment variables
        validation_url = os.getenv('TOKEN_VALIDATION_URL')

        response = requests.get(validation_url, headers={'Authorization': f'Bearer {token}'})
        if response.status_code != 200:
            return jsonify({'message': 'Invalid token!'}), 403

        return f(*args, **kwargs)

    return decorated


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200


@app.route('/tasks', methods=['POST'])
@token_required
def create_task():
    data = request.json
    if 'name' not in data:
        return jsonify({'message': 'Task name is required!'}), 400

    new_task = Task(name=data['name'])
    db.session.add(new_task)
    db.session.commit()
    return jsonify({'id': new_task.id, 'name': new_task.name}), 201


if __name__ == '__main__':
    # Create the database tables
    with app.app_context():
        db.create_all()
    app.run(debug=True)
