import React, { useState } from 'react';
import { Sparkles, Calendar as CalendarIcon, Target, ListTodo } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const AiPlanner: React.FC = () => {
  const [date, setDate] = useState<Date>(new Date());
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center space-x-3">
             <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                 <Sparkles size={24} className="text-purple-600" />
             </div>
             <div>
                <h1 className="text-3xl font-bold text-gray-900">AI Planner</h1>
                <p className="text-gray-500">Organize your study schedule and goals.</p>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold flex items-center space-x-2 mb-4 text-gray-900">
                        <Target size={18} className="text-purple-600" />
                        <span>Today's Focus</span>
                    </h2>
                    <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-200">
                        <ListTodo size={32} className="mx-auto mb-3 opacity-30 text-gray-400" />
                        <p>No tasks scheduled for today.</p>
                    </div>
                </div>
            </div>
            
            <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold flex items-center space-x-2 mb-4 text-gray-900">
                        <CalendarIcon size={18} className="text-purple-600" />
                        <span>Mini Calendar</span>
                    </h2>
                    <div className="flex justify-center bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <Calendar onChange={(val) => setDate(val as Date)} value={date} className="border-none bg-transparent" />
                    </div>
                </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AiPlanner;
